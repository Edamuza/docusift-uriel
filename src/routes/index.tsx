import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Sparkles, RotateCcw, Search, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ErrorState, LoadingState, PageHeader, Panel, StatusBadge } from "@/components/docu";
import { documentsQuery, settingsQuery, type DocRow } from "@/lib/queries";
import { peso, STATUS_LABELS, type DocStatus } from "@/lib/doc-schema";
import { SAMPLES } from "@/lib/samples";
import { ACCEPTED, MAX_BYTES, fileToJpeg, urlToJpeg } from "@/lib/render";
import { useProcessDocument } from "@/lib/use-process";
import { resetDemo, setAutoApprove } from "@/lib/docs.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Documents — DocuSift" },
      { name: "description", content: "Upload Philippine invoices and receipts or try a fictional sample; AI extracts and validates every field." },
      { property: "og:title", content: "Documents — DocuSift" },
      { property: "og:description", content: "AI invoice and receipt extraction with validation and human review." },
    ],
  }),
  component: DocumentsPage,
});

const STALE_MS = 2 * 60 * 1000;

function DocumentsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const docs = useQuery({
    ...documentsQuery,
    refetchInterval: (q) => (q.state.data?.some((d) => d.status === "processing") ? 3000 : false),
  });
  const settings = useQuery(settingsQuery);
  const { process } = useProcessDocument();
  const reset = useServerFn(resetDemo);
  const setAuto = useServerFn(setAutoApprove);
  const [busy, setBusy] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState<"all" | DocStatus>("all");
  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (docs.data ?? []).filter(
      (d) =>
        (status === "all" || d.status === status) &&
        (!term || [d.file_name, d.data?.vendor_name, d.data?.invoice_number].some((v) => v?.toLowerCase().includes(term))),
    );
  }, [docs.data, status, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: docs.data?.length ?? 0 };
    for (const d of docs.data ?? []) c[d.status] = (c[d.status] ?? 0) + 1;
    return c;
  }, [docs.data]);

  async function handleFile(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Please upload a PNG, JPG or PDF file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File is larger than 10 MB.");
      return;
    }
    setBusy(file.name);
    try {
      const img = await fileToJpeg(file);
      await process(file.name, img);
    } catch (e) {
      console.warn(e);
      toast.error("Could not read that file. Is it a valid image or PDF?");
    } finally {
      setBusy(null);
    }
  }

  async function trySample(slug: string, title: string) {
    setBusy(title);
    try {
      const img = await urlToJpeg(`/samples/${slug}.svg`);
      const id = await process(`${slug}.png`, img);
      navigate({ to: "/documents/$id", params: { id } });
    } catch {
      toast.error("Could not start the sample. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function doReset() {
    try {
      await reset();
      await qc.invalidateQueries();
      toast.success("Demo data restored.");
    } catch {
      toast.error("Could not reset demo data.");
    }
  }

  async function toggleAuto(v: boolean) {
    try {
      await setAuto({ data: { value: v } });
      await qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success(v ? "Clean documents will be auto-approved." : "All documents will go to review.");
    } catch {
      toast.error("Could not update the setting.");
    }
  }

  return (
    <div>
      <PageHeader title="Documents" subtitle="Invoices and official receipts turned into validated, structured data. Low-confidence or rule-breaking fields go to human review.">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm"><RotateCcw /> Reset demo data</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
              <AlertDialogDescription>This deletes every uploaded document and restores the four fictional seed documents and default settings.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={doReset}>Reset</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-5">
        <div
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-paper p-8 text-center transition-colors lg:col-span-2",
            drag ? "border-primary bg-accent" : "border-input hover:border-primary/60",
          )}
          onClick={() => !busy && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f && !busy) handleFile(f);
          }}
          role="button"
          tabIndex={0}
          aria-label="Upload a document"
        >
          <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) handleFile(f); }} />
          {busy && !SAMPLES.some((s) => s.title === busy) ? (
            <>
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="mt-3 font-medium">Extracting {busy}…</p>
              <p className="text-xs text-muted-foreground">This usually takes 10–40 seconds.</p>
            </>
          ) : (
            <>
              <FileUp className="size-8 text-primary" />
              <p className="mt-3 font-medium">Drop an invoice here or click to upload</p>
              <p className="text-xs text-muted-foreground">PNG, JPG or PDF (first page) · up to 10 MB</p>
            </>
          )}
        </div>

        <Panel className="p-5 lg:col-span-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h2 className="text-xl font-semibold">Try a sample document</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Three fictional Philippine documents — no files needed.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {SAMPLES.map((s) => (
              <button
                key={s.slug}
                disabled={!!busy}
                onClick={() => trySample(s.slug, s.title)}
                className="group flex flex-col overflow-hidden rounded-md border bg-paper text-left transition hover:border-primary hover:shadow-paper disabled:opacity-60"
              >
                <div className="h-28 overflow-hidden border-b bg-muted">
                  <img src={`/samples/${s.slug}.svg`} alt={`${s.title} sample`} className="w-full object-cover object-top transition group-hover:scale-105" />
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold leading-tight">{s.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.blurb}</p>
                  <p className="mt-2 text-xs font-medium text-primary">
                    {busy === s.title ? <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Extracting…</span> : "Extract →"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-72">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendor, file, invoice no." className="bg-paper pl-8" />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="bg-paper sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses ({counts['all']})</SelectItem>
              {(Object.keys(STATUS_LABELS) as DocStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]} ({counts[s] ?? 0})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={settings.data?.auto_approve ?? false} disabled={settings.isLoading} onCheckedChange={toggleAuto} />
          Auto-approve clean documents
        </label>
      </div>

      <div className="mt-4">
        {docs.isLoading ? (
          <LoadingState label="Loading documents…" />
        ) : docs.isError ? (
          <ErrorState message={(docs.error as Error).message} onRetry={() => docs.refetch()} />
        ) : filtered.length === 0 ? (
          <Panel className="p-10 text-center">
            <FileText className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 font-medium">{docs.data?.length ? "No documents match these filters" : "No documents yet"}</p>
            <p className="text-sm text-muted-foreground">{docs.data?.length ? "Try clearing the search or status filter." : "Upload an invoice or try a sample above."}</p>
          </Panel>
        ) : (
          <DocTable docs={filtered} />
        )}
      </div>
    </div>
  );
}

function Thumb({ d }: { d: DocRow }) {
  return d.image_url ? (
    <img src={d.image_url} alt="" loading="lazy" className="h-12 w-10 rounded border bg-paper object-cover object-top" />
  ) : (
    <div className="h-12 w-10 rounded border bg-muted" />
  );
}

function stale(d: DocRow) {
  return d.status === "processing" && Date.now() - new Date(d.updated_at).getTime() > STALE_MS;
}

function DocTable({ docs }: { docs: DocRow[] }) {
  return (
    <Panel className="overflow-hidden">
      <table className="hidden w-full text-sm md:table">
        <thead className="border-b bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Document</th>
            <th className="px-4 py-3 font-medium">Vendor</th>
            <th className="px-4 py-3 text-right font-medium">Total (PHP)</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} className="border-b last:border-0 hover:bg-secondary/40">
              <td className="px-4 py-2">
                <Link to="/documents/$id" params={{ id: d.id }} className="flex items-center gap-3 font-medium hover:text-primary">
                  <Thumb d={d} />
                  <span className="max-w-56 truncate">{d.file_name}</span>
                </Link>
              </td>
              <td className="px-4 py-2">{d.data?.vendor_name ?? <span className="text-muted-foreground">—</span>}</td>
              <td className="tabular px-4 py-2 text-right">{peso(d.data?.total_amount)}</td>
              <td className="tabular px-4 py-2">{d.data?.invoice_date ?? "—"}</td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.status} />
                  {(d.status === "failed" || stale(d)) && (
                    <Link to="/documents/$id" params={{ id: d.id }} className="text-xs font-medium text-primary underline">Retry</Link>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y md:hidden">
        {docs.map((d) => (
          <li key={d.id}>
            <Link to="/documents/$id" params={{ id: d.id }} className="flex items-center gap-3 p-3" aria-label={d.file_name}>
              <Thumb d={d} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.data?.vendor_name ?? d.file_name}</p>
                <p className="tabular text-xs text-muted-foreground">{d.data?.invoice_date ?? "—"} · PHP {peso(d.data?.total_amount)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={d.status} />
                {(d.status === "failed" || stale(d)) && <span className="text-xs font-medium text-primary underline">Retry</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
