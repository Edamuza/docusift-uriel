import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, CheckCircle2, Loader2, Minus, Plus, RefreshCw, Save, Trash2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ConfidenceBadge, ErrorState, LoadingState, Panel, StatusBadge } from "@/components/docu";
import { documentQuery, type DocRow } from "@/lib/queries";
import {
  changedFields, DOC_TYPES, emptyDoc, FIELD_LABELS, MONEY_FIELDS, peso, validate,
  type DocData, type LineItem, type TopField,
} from "@/lib/doc-schema";
import { deleteDocument, saveDocument } from "@/lib/docs.functions";
import { urlToJpeg } from "@/lib/render";
import { useProcessDocument } from "@/lib/use-process";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/documents/$id")({
  head: () => ({
    meta: [
      { title: "Review document — DocuSift" },
      { name: "description", content: "Review AI-extracted invoice fields with confidence scores and validation rules." },
      { property: "og:title", content: "Review document — DocuSift" },
      { property: "og:description", content: "Human-in-the-loop review of extracted invoice data." },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { id } = Route.useParams();
  const doc = useQuery({
    ...documentQuery(id),
    refetchInterval: (q) => (q.state.data?.status === "processing" ? 2500 : false),
  });

  if (doc.isLoading) return <LoadingState label="Loading document…" />;
  if (doc.isError) return <ErrorState message={(doc.error as Error).message} onRetry={() => doc.refetch()} />;
  if (!doc.data)
    return (
      <Panel className="p-10 text-center">
        <p className="font-medium">Document not found</p>
        <p className="text-sm text-muted-foreground">It may have been deleted or the demo was reset.</p>
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-primary underline">Back to documents</Link>
      </Panel>
    );
  return <Review key={`${doc.data.id}-${doc.data.status}-${doc.data.processing_ms}`} row={doc.data} />;
}

function Review({ row }: { row: DocRow}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const save = useServerFn(saveDocument);
  const del = useServerFn(deleteDocument);
  const { runExtraction } = useProcessDocument();
  const [form, setForm] = useState<DocData>(row.data ?? emptyDoc());
  const [zoom, setZoom] = useState(1);
  const [action, setAction] = useState<null | "approve" | "save" | "extract" | "delete">(null);

  useEffect(() => setForm(row.data ?? emptyDoc()), [row.data]);

  const rules = useMemo(() => validate(form), [form]);
  const edited = useMemo(() => (row.extracted ? changedFields(row.extracted, form) : []), [row.extracted, form]);
  const hasData = !!row.extracted;
  const stale = row.status === "processing" && Date.now() - new Date(row.updated_at).getTime() > 2 * 60 * 1000;
  const processing = (row.status === "processing" && !stale) || action === "extract";

  const set = <K extends keyof DocData>(k: K, v: DocData[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (i: number, patch: Partial<LineItem>) =>
    setForm((f) => ({ ...f, line_items: f.line_items.map((li, j) => (j === i ? { ...li, ...patch } : li)) }));

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["documents"] });
  }

  async function doSave(approve: boolean) {
    setAction(approve ? "approve" : "save");
    try {
      const res = await save({ data: { id: row.id, data: form, approve } });
      toast.success(
        approve
          ? `Approved${res.changed.length ? ` — ${res.changed.length} field${res.changed.length > 1 ? "s" : ""} corrected` : " with no corrections"}`
          : "Draft saved",
      );
      await refresh();
      if (approve) navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setAction(null);
    }
  }

  async function doExtract() {
    if (!row.image_url) {
      toast.error("No image stored for this document.");
      return;
    }
    setAction("extract");
    try {
      const img = await urlToJpeg(row.image_url);
      await runExtraction(row.id, img);
    } catch (e) {
      toast.error(e instanceof Error && e.message.startsWith("Could not read") ? e.message : "Could not load the document image.");
    } finally {
      setAction(null);
    }
  }

  async function doDelete() {
    setAction("delete");
    try {
      await del({ data: { id: row.id } });
      toast.success("Document deleted");
      await refresh();
      navigate({ to: "/" });
    } catch {
      toast.error("Could not delete the document.");
      setAction(null);
    }
  }

  const failedRules = rules.filter((r) => !r.pass).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className="rounded-md p-1.5 hover:bg-secondary" aria-label="Back"><ArrowLeft className="size-5" /></Link>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{form.vendor_name || row.file_name}</h1>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <StatusBadge status={processing ? "processing" : stale ? "failed" : row.status} />
              <span className="truncate">{row.file_name}</span>
              {row.processing_ms != null && <span className="tabular">· {(row.processing_ms / 1000).toFixed(1)}s</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => doSave(true)} disabled={!hasData || processing || !!action}>
            {action === "approve" ? <Loader2 className="animate-spin" /> : <Check />} Approve
          </Button>
          <Button size="sm" variant="secondary" onClick={() => doSave(false)} disabled={!hasData || processing || !!action}>
            {action === "save" ? <Loader2 className="animate-spin" /> : <Save />} Save draft
          </Button>
          <Button size="sm" variant="outline" onClick={doExtract} disabled={processing || !!action}>
            <RefreshCw className={cn(processing && "animate-spin")} /> Re-extract
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={!!action} className="text-danger"><Trash2 /> Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this document?</AlertDialogTitle>
                <AlertDialogDescription>The image and all extracted data will be removed.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={doDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Image viewer */}
        <Panel className="flex flex-col overflow-hidden lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
          <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
            <span>Original document</span>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="size-7" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Zoom out"><Minus /></Button>
              <button className="tabular w-12 text-center" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Zoom in"><Plus /></Button>
            </div>
          </div>
          <div className="max-h-[70vh] flex-1 overflow-auto bg-muted p-3 lg:max-h-none">
            {row.image_url ? (
              <img src={row.image_url} alt={`Scan of ${row.file_name}`} style={{ width: `${zoom * 100}%`, maxWidth: "none" }} className="mx-auto block rounded border bg-paper shadow-paper" />
            ) : (
              <p className="p-8 text-center text-sm text-muted-foreground">No image</p>
            )}
          </div>
        </Panel>

        {/* Fields */}
        <div className="flex flex-col gap-4">
          {processing && (
            <Panel className="flex items-center gap-3 p-4 text-sm">
              <Loader2 className="size-5 animate-spin text-info" />
              <div>
                <p className="font-medium">Extracting with Lovable AI…</p>
                <p className="text-xs text-muted-foreground">Reading the document and filling in fields. Usually 10–40 seconds.</p>
              </div>
            </Panel>
          )}
          {(row.status === "failed" || stale) && !processing && (
            <Panel className="border-danger/40 bg-danger-soft p-4 text-sm">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 size-5 text-danger" />
                <div className="flex-1">
                  <p className="font-medium text-danger">{stale ? "Extraction did not finish" : "Extraction failed"}</p>
                  <p className="text-muted-foreground">{stale ? "The extraction was interrupted (for example, the tab was closed). Please retry." : (row.error ?? "Unknown error.")}</p>
                </div>
                <Button size="sm" onClick={doExtract}><RefreshCw /> Retry</Button>
              </div>
            </Panel>
          )}

          {hasData && (
            <>
              <Panel className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Validation</h2>
                  <span className={cn("text-xs font-medium", failedRules ? "text-danger" : "text-success")}>
                    {failedRules ? `${failedRules} rule${failedRules > 1 ? "s" : ""} failing` : "All rules pass"}
                  </span>
                </div>
                <ul className="space-y-2">
                  {rules.map((r) => (
                    <li key={r.id} data-rule={r.id} data-pass={r.pass} className="flex gap-2 text-sm">
                      {r.pass ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />}
                      <div>
                        <span className="font-medium">{r.name}</span>
                        <span className="text-muted-foreground"> — {r.detail}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">Extracted fields</h2>
                  {edited.length > 0 && <span className="text-xs text-info">{edited.length} edited by you</span>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldShell field="document_type" conf={row.confidence.document_type} edited={edited.includes("document_type")}>
                    <Select value={form.document_type ?? ""} onValueChange={(v) => set("document_type", v)}>
                      <SelectTrigger className="bg-paper"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </FieldShell>
                  {(["vendor_name", "vendor_tin", "vendor_address", "buyer_name", "invoice_number"] as const).map((f) => (
                    <FieldShell key={f} field={f} conf={row.confidence[f]} edited={edited.includes(f)} wide={f === "vendor_address" || f === "vendor_name"}>
                      <Input value={form[f] ?? ""} onChange={(e) => set(f, e.target.value || null)} className="bg-paper" />
                    </FieldShell>
                  ))}
                  <FieldShell field="invoice_date" conf={row.confidence.invoice_date} edited={edited.includes("invoice_date")}>
                    <Input type="date" value={form.invoice_date ?? ""} onChange={(e) => set("invoice_date", e.target.value || null)} className="bg-paper" />
                  </FieldShell>
                  <FieldShell field="currency" conf={row.confidence.currency} edited={edited.includes("currency")}>
                    <Input value={form.currency ?? ""} onChange={(e) => set("currency", e.target.value.toUpperCase() || null)} className="bg-paper" />
                  </FieldShell>
                  {MONEY_FIELDS.map((f) => (
                    <FieldShell key={f} field={f} conf={row.confidence[f]} edited={edited.includes(f)}>
                      <NumInput value={form[f]} onChange={(v) => set(f, v)} />
                    </FieldShell>
                  ))}
                </div>
              </Panel>

              <Panel className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Line items</h2>
                    <ConfidenceBadge value={row.confidence.line_items} />
                    {edited.includes("line_items") && <span className="text-xs text-info">edited</span>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => set("line_items", [...form.line_items, { description: "", quantity: 1, unit_price: 0, amount: 0 }])}>
                    <Plus /> Add row
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="pb-2 font-medium">Description</th>
                        <th className="w-20 pb-2 font-medium">Qty</th>
                        <th className="w-28 pb-2 font-medium">Unit price</th>
                        <th className="w-28 pb-2 font-medium">Amount</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.line_items.map((li, i) => (
                        <tr key={i}>
                          <td className="py-1 pr-2"><Input value={li.description} onChange={(e) => setItem(i, { description: e.target.value })} className="h-8 bg-paper" /></td>
                          <td className="py-1 pr-2"><NumInput small value={li.quantity} onChange={(v) => setItem(i, { quantity: v })} /></td>
                          <td className="py-1 pr-2"><NumInput small value={li.unit_price} onChange={(v) => setItem(i, { unit_price: v })} /></td>
                          <td className="py-1 pr-2"><NumInput small value={li.amount} onChange={(v) => setItem(i, { amount: v })} /></td>
                          <td className="py-1">
                            <Button size="icon" variant="ghost" className="size-7" aria-label="Remove row" onClick={() => set("line_items", form.line_items.filter((_, j) => j !== i))}><Trash2 /></Button>
                          </td>
                        </tr>
                      ))}
                      {form.line_items.length === 0 && (
                        <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No line items</td></tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t">
                        <td colSpan={3} className="pt-2 text-right text-xs text-muted-foreground">Sum of amounts</td>
                        <td className="tabular pt-2 font-medium">{peso(form.line_items.reduce((s, li) => s + (li.amount ?? 0), 0))}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldShell({ field, conf, edited, wide, children }: { field: TopField; conf: number | undefined; edited: boolean; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={cn("block", wide && "sm:col-span-2")} data-field={field}>
      <span className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-muted-foreground">
          {FIELD_LABELS[field]} {edited && <span className="text-info">· edited</span>}
        </span>
        <ConfidenceBadge value={conf} />
      </span>
      {children}
    </label>
  );
}

function NumInput({ value, onChange, small }: { value: number | null; onChange: (v: number | null) => void; small?: boolean }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => {
    const parsed = text.trim() === "" ? null : Number(text.replace(/,/g, ""));
    if (parsed !== value) setText(value == null ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <Input
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const raw = e.target.value.replace(/,/g, "").trim();
        if (raw === "") onChange(null);
        else if (!isNaN(Number(raw))) onChange(Number(raw));
      }}
      className={cn("tabular bg-paper", small && "h-8")}
    />
  );
}
