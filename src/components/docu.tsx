import { cn } from "@/lib/utils";
import { confidenceLevel, STATUS_LABELS, type DocStatus } from "@/lib/doc-schema";
import { Loader2 } from "lucide-react";

const statusStyles: Record<DocStatus, string> = {
  processing: "bg-info-soft text-info border-info/30",
  needs_review: "bg-warning-soft text-warning border-warning/40",
  approved: "bg-success-soft text-success border-success/40",
  failed: "bg-danger-soft text-danger border-danger/40",
};

export function StatusBadge({ status }: { status: DocStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", statusStyles[status])}>
      {status === "processing" && <Loader2 className="size-3 animate-spin" />}
      {STATUS_LABELS[status]}
    </span>
  );
}

const confStyles = {
  high: "bg-success-soft text-success border-success/40",
  medium: "bg-warning-soft text-warning border-warning/40",
  low: "bg-danger-soft text-danger border-danger/40",
};

export function ConfidenceBadge({ value }: { value: number | undefined }) {
  const level = confidenceLevel(value);
  return (
    <span
      title={`AI confidence: ${level}`}
      data-level={level}
      className={cn("tabular inline-flex items-center rounded border px-1.5 py-px text-[11px] font-medium", confStyles[level])}
    >
      {Math.round((value ?? 0) * 100)}% {level}
    </span>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-lg border bg-card shadow-paper", className)}>{children}</section>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Panel className="p-8 text-center">
      <p className="font-medium text-danger">Something went wrong</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 text-sm font-medium text-primary underline underline-offset-4">
          Try again
        </button>
      )}
    </Panel>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}
