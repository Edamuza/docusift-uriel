import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/docu";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About this project — DocuSift" },
      { name: "description", content: "Why DocuSift exists, how it uses AI extraction with human review, and its architecture. By Uriel Papa." },
      { property: "og:title", content: "About DocuSift — a portfolio project by Uriel Papa" },
      { property: "og:description", content: "Problem, approach, architecture and next steps for an AI invoice extraction tool." },
    ],
  }),
  component: AboutPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel className="p-6">
      <h2 className="mb-3 text-2xl font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-foreground/90">{children}</div>
    </Panel>
  );
}

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="About this project" subtitle="DocuSift is a portfolio piece by Uriel Papa, built to show an AI document-automation workflow end to end." />
      <div className="space-y-4">
        <Section title="The problem">
          <p>Philippine SMEs, bookkeepers and accounts-payable teams still key in sales invoices and official receipts by hand — vendor TINs, VAT breakdowns and line items — for BIR compliance and expense reporting.</p>
          <p>A clerk typically spends 3–5 minutes per document, and typos in a TIN or VAT amount cause rework, failed reconciliations and audit risk. At a few hundred documents a month, that is days of skilled time spent copying numbers.</p>
        </Section>
        <Section title="The approach">
          <p>A vision model reads the document image and returns <strong>structured output</strong> against a fixed schema, with a confidence score per field. Arithmetic and format checks are then computed <strong>deterministically in code</strong> — the model is never trusted to grade its own math.</p>
          <p>This is the <strong>human-in-the-loop</strong> pattern: anything low-confidence or rule-breaking is routed to a reviewer, every correction is recorded, and those corrections become a field-level accuracy report that shows exactly where the AI can be trusted to auto-approve.</p>
        </Section>
        <Section title="Architecture">
          <pre className="tabular overflow-x-auto rounded-md bg-secondary p-3 text-xs">{`Browser (React + TanStack Start)
  └─ renders PDF page 1 / SVG sample → JPEG (pdf.js, canvas)
       ↓ server functions (edge runtime)
  createDocument → Cloud storage "uploads" + documents row
  extractDocument → Lovable AI vision model (structured output)
                  → validation rules in code → status
  saveDocument / deleteDocument / setAutoApprove / resetDemo
       ↓
Lovable Cloud database (Postgres, RLS on)`}</pre>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Tables:</strong> <code>documents</code> (image, extracted values, reviewed values, confidence, changed fields, timing, status) and <code>app_settings</code> (auto-approve flag). Both are read-only to the public; all writes go through server functions.</li>
            <li><strong>Functions:</strong> createDocument, extractDocument, saveDocument, deleteDocument, setAutoApprove, resetDemo, plus a <code>reset_demo()</code> database function that restores the seed state.</li>
            <li><strong>Validation:</strong> line items vs. sales, totals reconcile, VAT = 12%, TIN format, valid non-future date — each ±₱1.00.</li>
          </ul>
        </Section>
        <Section title="What I'd do next in a real deployment">
          <ul className="list-disc space-y-1 pl-5">
            <li>Authentication with per-company workspaces and reviewer roles; audit trail of who approved what.</li>
            <li>Multi-page PDFs, email/Drive ingestion and a background queue for batch uploads.</li>
            <li>Vendor master data: match TINs to known suppliers and flag new or mismatched vendors.</li>
            <li>Push approved data to Xero, QuickBooks or an ERP instead of CSV; per-field auto-approve thresholds tuned from the accuracy report.</li>
            <li>An evaluation set of real (redacted) documents to compare models and prompts before each change.</li>
          </ul>
        </Section>
        <Panel className="flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Author</p>
            <p className="font-display text-xl font-semibold">Uriel Papa</p>
          </div>
          <div className="flex gap-4 text-sm font-medium">
            <a href="https://github.com/Edamuza" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">GitHub</a>
            <a href="https://linkedin.com/in/uriel-papa-vitese01" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">LinkedIn</a>
          </div>
        </Panel>
      </div>
    </div>
  );
}
