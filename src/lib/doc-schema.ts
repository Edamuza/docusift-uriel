// Shared, client-safe types and pure logic for DocuSift.

export const DOC_TYPES = ["Sales Invoice", "Official Receipt", "Delivery Receipt", "Other"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export type LineItem = {
  description: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
};

export type DocData = {
  document_type: string | null;
  vendor_name: string | null;
  vendor_tin: string | null;
  vendor_address: string | null;
  buyer_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  currency: string | null;
  vatable_sales: number | null;
  vat_amount: number | null;
  vat_exempt_sales: number | null;
  total_amount: number | null;
  line_items: LineItem[];
};

export const TEXT_FIELDS = [
  "document_type",
  "vendor_name",
  "vendor_tin",
  "vendor_address",
  "buyer_name",
  "invoice_number",
  "invoice_date",
  "currency",
] as const;
export const MONEY_FIELDS = ["vatable_sales", "vat_amount", "vat_exempt_sales", "total_amount"] as const;
export const TOP_FIELDS = [...TEXT_FIELDS, ...MONEY_FIELDS] as const;
export type TopField = (typeof TOP_FIELDS)[number];
/** Fields counted for accuracy: every top-level field plus the line-item table as one field. */
export const ACCURACY_FIELDS = [...TOP_FIELDS, "line_items"] as const;
export type AccuracyField = (typeof ACCURACY_FIELDS)[number];

export const FIELD_LABELS: Record<AccuracyField, string> = {
  document_type: "Document type",
  vendor_name: "Vendor name",
  vendor_tin: "Vendor TIN",
  vendor_address: "Vendor address",
  buyer_name: "Buyer name",
  invoice_number: "Invoice / OR no.",
  invoice_date: "Date",
  currency: "Currency",
  vatable_sales: "VATable sales",
  vat_amount: "VAT amount",
  vat_exempt_sales: "VAT-exempt sales",
  total_amount: "Total amount",
  line_items: "Line items",
};

export type Confidence = Partial<Record<AccuracyField, number>>;

export type DocStatus = "processing" | "needs_review" | "approved" | "failed";
export const STATUS_LABELS: Record<DocStatus, string> = {
  processing: "Processing",
  needs_review: "Needs review",
  approved: "Approved",
  failed: "Failed",
};

export type RuleResult = { id: string; name: string; pass: boolean; detail: string };

export const LOW_CONFIDENCE = 0.75;
export const HIGH_CONFIDENCE = 0.9;
export const TOLERANCE = 1.0;

export function confidenceLevel(c: number | undefined | null): "high" | "medium" | "low" {
  const v = c ?? 0;
  if (v >= HIGH_CONFIDENCE) return "high";
  if (v >= LOW_CONFIDENCE) return "medium";
  return "low";
}

const n = (v: number | null | undefined) => (typeof v === "number" && isFinite(v) ? v : 0);
export const peso = (v: number | null | undefined) =>
  typeof v === "number" && isFinite(v)
    ? v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";

export const TIN_PATTERN = /^\d{3}-\d{3}-\d{3}-\d{3,5}$/;

export function validate(d: DocData, today: Date = new Date()): RuleResult[] {
  const itemsSum = d.line_items.reduce((s, li) => s + n(li.amount), 0);
  const base = n(d.vatable_sales) + n(d.vat_exempt_sales);
  const computedTotal = n(d.vatable_sales) + n(d.vat_amount) + n(d.vat_exempt_sales);
  const expectedVat = n(d.vatable_sales) * 0.12;
  const r: RuleResult[] = [];

  const liDiff = itemsSum - base;
  r.push({
    id: "line_items",
    name: "Line items add up",
    pass: d.line_items.length > 0 && Math.abs(liDiff) <= TOLERANCE,
    detail:
      d.line_items.length === 0
        ? "No line items were found."
        : Math.abs(liDiff) <= TOLERANCE
          ? `Line items total PHP ${peso(itemsSum)}, matching VATable + VAT-exempt sales.`
          : `Line items total PHP ${peso(itemsSum)} but VATable + VAT-exempt sales is PHP ${peso(base)} (off by PHP ${peso(Math.abs(liDiff))}).`,
  });

  const totDiff = n(d.total_amount) - computedTotal;
  r.push({
    id: "totals",
    name: "Totals reconcile",
    pass: d.total_amount != null && Math.abs(totDiff) <= TOLERANCE,
    detail:
      d.total_amount == null
        ? "No total amount was found."
        : Math.abs(totDiff) <= TOLERANCE
          ? `VATable + VAT + VAT-exempt = PHP ${peso(computedTotal)}, matching the total.`
          : `VATable + VAT + VAT-exempt = PHP ${peso(computedTotal)}, but the printed total is PHP ${peso(d.total_amount)} — PHP ${peso(Math.abs(totDiff))} ${totDiff > 0 ? "higher" : "lower"} than it should be.`,
  });

  const vatDiff = n(d.vat_amount) - expectedVat;
  r.push({
    id: "vat",
    name: "VAT is 12%",
    pass: Math.abs(vatDiff) <= TOLERANCE,
    detail:
      Math.abs(vatDiff) <= TOLERANCE
        ? `VAT of PHP ${peso(n(d.vat_amount))} is 12% of VATable sales.`
        : `Expected VAT of PHP ${peso(expectedVat)} (12% of PHP ${peso(n(d.vatable_sales))}) but found PHP ${peso(n(d.vat_amount))}.`,
  });

  const tin = (d.vendor_tin ?? "").trim();
  r.push({
    id: "tin",
    name: "TIN format",
    pass: TIN_PATTERN.test(tin),
    detail: TIN_PATTERN.test(tin)
      ? `TIN ${tin} matches ###-###-###-###.`
      : tin
        ? `TIN "${tin}" does not match ###-###-###-### (last group 3–5 digits).`
        : "No vendor TIN was found.",
  });

  const ds = (d.invoice_date ?? "").trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(ds) ? new Date(ds + "T00:00:00Z") : null;
  const valid = parsed != null && !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === ds;
  const todayStr = today.toISOString().slice(0, 10);
  const future = valid && ds > todayStr;
  r.push({
    id: "date",
    name: "Valid date",
    pass: valid && !future,
    detail: !ds
      ? "No date was found."
      : !valid
        ? `"${ds}" is not a valid date (expected YYYY-MM-DD).`
        : future
          ? `${ds} is in the future.`
          : `${ds} is a valid past date.`,
  });
  return r;
}

export function hasLowConfidence(c: Confidence): boolean {
  return ACCURACY_FIELDS.some((f) => (c[f] ?? 0) < LOW_CONFIDENCE);
}

export function isClean(c: Confidence, rules: RuleResult[]): boolean {
  return ACCURACY_FIELDS.every((f) => (c[f] ?? 0) >= HIGH_CONFIDENCE) && rules.every((r) => r.pass);
}

/** Status after extraction. */
export function statusAfterExtraction(c: Confidence, rules: RuleResult[], autoApprove: boolean): DocStatus {
  if (hasLowConfidence(c) || rules.some((r) => !r.pass)) return "needs_review";
  return autoApprove && isClean(c, rules) ? "approved" : "needs_review";
}

const norm = (v: unknown) =>
  typeof v === "number" ? Math.round(v * 100) / 100 : typeof v === "string" ? v.trim().toLowerCase() : v ?? null;

function sameItems(a: LineItem[], b: LineItem[]) {
  if (a.length !== b.length) return false;
  return a.every(
    (x, i) =>
      norm(x.description) === norm(b[i]?.description) &&
      norm(x.quantity) === norm(b[i]?.quantity) &&
      norm(x.unit_price) === norm(b[i]?.unit_price) &&
      norm(x.amount) === norm(b[i]?.amount),
  );
}

export function changedFields(extracted: DocData, final: DocData): AccuracyField[] {
  const out: AccuracyField[] = [];
  for (const f of TOP_FIELDS) {
    const a = norm(extracted[f] === "" ? null : extracted[f]);
    const b = norm(final[f] === "" ? null : final[f]);
    if (a !== b) out.push(f);
  }
  if (!sameItems(extracted.line_items ?? [], final.line_items ?? [])) out.push("line_items");
  return out;
}

export type AccuracyDoc = { changed_fields: string[]; confidence: Confidence; validation_extracted: RuleResult[]; processing_ms: number | null };

export function computeAccuracy(docs: AccuracyDoc[]) {
  const total = docs.length;
  const perField = ACCURACY_FIELDS.map((f) => {
    const changed = docs.filter((d) => d.changed_fields.includes(f)).length;
    return { field: f, label: FIELD_LABELS[f], changed, accuracy: total ? (total - changed) / total : null };
  });
  const totalFields = total * ACCURACY_FIELDS.length;
  const changedCount = perField.reduce((s, p) => s + p.changed, 0);
  const overall = totalFields ? (totalFields - changedCount) / totalFields : null;
  const autoApprovable = total ? docs.filter((d) => isClean(d.confidence, d.validation_extracted)).length / total : null;
  const times = docs.map((d) => d.processing_ms).filter((x): x is number => typeof x === "number");
  const avgMs = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
  return { total, perField, overall, autoApprovable, avgMs, changedCount, totalFields };
}

export function emptyDoc(): DocData {
  return {
    document_type: null, vendor_name: null, vendor_tin: null, vendor_address: null, buyer_name: null,
    invoice_number: null, invoice_date: null, currency: "PHP", vatable_sales: null, vat_amount: null,
    vat_exempt_sales: null, total_amount: null, line_items: [],
  };
}
