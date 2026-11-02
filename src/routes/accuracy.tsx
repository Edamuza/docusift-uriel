import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ErrorState, LoadingState, PageHeader, Panel } from "@/components/docu";
import { documentsQuery } from "@/lib/queries";
import { computeAccuracy, emptyDoc, validate } from "@/lib/doc-schema";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/accuracy")({
  head: () => ({
    meta: [
      { title: "Accuracy report — DocuSift" },
      { name: "description", content: "Field-by-field AI extraction accuracy measured against human reviewer corrections." },
      { property: "og:title", content: "Accuracy report — DocuSift" },
      { property: "og:description", content: "How often the AI was right, field by field." },
    ],
  }),
  component: AccuracyPage,
});

const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

function AccuracyPage() {
  const docs = useQuery(documentsQuery);
  const stats = useMemo(() => {
    const approved = (docs.data ?? []).filter((d) => d.status === "approved" && d.extracted);
    return computeAccuracy(
      approved.map((d) => ({
        changed_fields: d.changed_fields,
        confidence: d.confidence,
        validation_extracted: validate(d.extracted ?? emptyDoc(), new Date(d.created_at)),
        processing_ms: d.processing_ms,
      })),
    );
  }, [docs.data]);

  if (docs.isLoading) return <LoadingState />;
  if (docs.isError) return <ErrorState message={(docs.error as Error).message} onRetry={() => docs.refetch()} />;

  return (
    <div>
      <PageHeader title="Accuracy" subtitle="For approved documents: a field counts as correct when the reviewer did not change the AI's value." />
      {stats.total === 0 ? (
        <Panel className="p-10 text-center">
          <p className="font-medium">No approved documents yet</p>
          <p className="text-sm text-muted-foreground">Approve a document on the <Link to="/" className="text-primary underline">Documents</Link> page to see accuracy.</p>
        </Panel>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Overall field accuracy" value={pct(stats.overall)} note={`${stats.totalFields - stats.changedCount} of ${stats.totalFields} fields unchanged`} />
            <Kpi label="Approved documents" value={String(stats.total)} note="Basis for this report" />
            <Kpi label="Auto-approvable" value={pct(stats.autoApprovable)} note="All fields high confidence and all rules pass" />
            <Kpi label="Avg. processing time" value={stats.avgMs == null ? "—" : `${(stats.avgMs / 1000).toFixed(1)}s`} note="Image to validated fields" />
          </div>
          <Panel className="mt-4 p-5">
            <h2 className="mb-4 text-lg font-semibold">Accuracy by field</h2>
            <ul className="space-y-2.5">
              {stats.perField.map((p) => (
                <li key={p.field} data-field={p.field} className="grid grid-cols-[8rem_1fr_4.5rem] items-center gap-3 text-sm sm:grid-cols-[11rem_1fr_6rem]">
                  <span className="truncate text-muted-foreground">{p.label}</span>
                  <div className="h-5 overflow-hidden rounded bg-muted">
                    <div
                      className={cn("h-full rounded transition-all", (p.accuracy ?? 0) >= 0.9 ? "bg-success" : (p.accuracy ?? 0) >= 0.75 ? "bg-warning" : "bg-danger")}
                      style={{ width: `${(p.accuracy ?? 0) * 100}%` }}
                    />
                  </div>
                  <span className="tabular text-right">
                    {pct(p.accuracy)}
                    {p.changed > 0 && <span className="block text-[10px] text-muted-foreground">{p.changed} corrected</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Panel className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-3xl font-medium">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </Panel>
  );
}
