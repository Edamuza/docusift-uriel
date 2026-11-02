import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, LoadingState, PageHeader, Panel, StatusBadge } from "@/components/docu";
import { documentsQuery } from "@/lib/queries";
import { peso, STATUS_LABELS, type DocStatus } from "@/lib/doc-schema";
import { documentsCsv, lineItemsCsv } from "@/lib/csv";

export const Route = createFileRoute("/export")({
  head: () => ({
    meta: [
      { title: "Export CSV — DocuSift" },
      { name: "description", content: "Export approved invoice data to CSV, one row per document or per line item." },
      { property: "og:title", content: "Export CSV — DocuSift" },
      { property: "og:description", content: "Download validated invoice data as CSV." },
    ],
  }),
  component: ExportPage,
});

function download(csv: string, name: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function ExportPage() {
  const docs = useQuery(documentsQuery);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<DocStatus | "all">("approved");

  const rows = useMemo(
    () =>
      (docs.data ?? []).filter((d) => {
        if (!d.data) return false;
        if (status !== "all" && d.status !== status) return false;
        const date = d.data.invoice_date ?? "";
        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
      }),
    [docs.data, from, to, status],
  );
  const stamp = new Date().toISOString().slice(0, 10);
  const itemCount = rows.reduce((s, r) => s + (r.data?.line_items.length ?? 0), 0);

  return (
    <div>
      <PageHeader title="Export" subtitle="Choose a date range and status, preview the rows, then download CSV.">
        <Button disabled={!rows.length} onClick={() => download(documentsCsv(rows), `docusift-documents-${stamp}.csv`)}>
          <Download /> Documents CSV
        </Button>
        <Button variant="secondary" disabled={!rows.length} onClick={() => download(lineItemsCsv(rows), `docusift-line-items-${stamp}.csv`)}>
          <Download /> Line items CSV
        </Button>
      </PageHeader>

      <Panel className="mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <label className="text-xs font-medium text-muted-foreground">From (document date)
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 bg-paper" />
        </label>
        <label className="text-xs font-medium text-muted-foreground">To
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 bg-paper" />
        </label>
        <label className="text-xs font-medium text-muted-foreground">Status
          <Select value={status} onValueChange={(v) => setStatus(v as DocStatus | "all")}>
            <SelectTrigger className="mt-1 bg-paper"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="approved">Approved only</SelectItem>
              <SelectItem value="needs_review">{STATUS_LABELS.needs_review}</SelectItem>
              <SelectItem value="all">All extracted</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </Panel>

      {docs.isLoading ? (
        <LoadingState />
      ) : docs.isError ? (
        <ErrorState message={(docs.error as Error).message} onRetry={() => docs.refetch()} />
      ) : rows.length === 0 ? (
        <Panel className="p-10 text-center">
          <p className="font-medium">No documents match</p>
          <p className="text-sm text-muted-foreground">Approve documents on the <Link to="/" className="text-primary underline">Documents</Link> page or widen the filters.</p>
        </Panel>
      ) : (
        <Panel className="overflow-x-auto">
          <p className="border-b px-4 py-2 text-xs text-muted-foreground">{rows.length} document{rows.length > 1 ? "s" : ""} · {itemCount} line items</p>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Vendor</th>
                <th className="px-4 py-2 font-medium">TIN</th>
                <th className="px-4 py-2 font-medium">No.</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 text-right font-medium">VAT</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{r.data?.vendor_name}</td>
                  <td className="tabular px-4 py-2">{r.data?.vendor_tin}</td>
                  <td className="tabular px-4 py-2">{r.data?.invoice_number}</td>
                  <td className="tabular px-4 py-2">{r.data?.invoice_date}</td>
                  <td className="tabular px-4 py-2 text-right">{peso(r.data?.vat_amount)}</td>
                  <td className="tabular px-4 py-2 text-right">{peso(r.data?.total_amount)}</td>
                  <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
