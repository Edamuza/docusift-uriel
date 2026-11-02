import { TOP_FIELDS } from "./doc-schema";
import type { DocRow } from "./queries";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const line = (vals: unknown[]) => vals.map(cell).join(",");

export function documentsCsv(rows: DocRow[]) {
  const head = ["document_id", "file_name", "status", ...TOP_FIELDS, "line_item_count", "approved_at", "fields_corrected"];
  return [
    line(head),
    ...rows.map((r) =>
      line([
        r.id, r.file_name, r.status,
        ...TOP_FIELDS.map((f) => r.data?.[f]),
        r.data?.line_items.length ?? 0, r.approved_at ?? "", r.changed_fields.join("; "),
      ]),
    ),
  ].join("\r\n");
}

export function lineItemsCsv(rows: DocRow[]) {
  const head = ["document_id", "vendor_name", "invoice_number", "invoice_date", "line_no", "description", "quantity", "unit_price", "amount"];
  const out = [line(head)];
  for (const r of rows)
    (r.data?.line_items ?? []).forEach((li, i) =>
      out.push(line([r.id, r.data?.vendor_name, r.data?.invoice_number, r.data?.invoice_date, i + 1, li.description, li.quantity, li.unit_price, li.amount])),
    );
  return out.join("\r\n");
}
