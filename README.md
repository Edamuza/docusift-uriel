# Docusift Uriel

Build this complete app now, all screens and the backend, following the spec below. Use Lovable Cloud and Lovable AI; do not ask me for API keys.

# Project 4 — DocuSift: invoice and receipt extraction with human review

Build "DocuSift", a document-automation tool that turns invoices and official receipts (Philippine format) into structured, validated data. Low-confidence or rule-breaking fields go to a human review screen; approved data exports to CSV. An accuracy report shows how often the AI was right, field by field.

## Screens
1. **Documents** (home): table of documents (thumbnail, file name, vendor, total, date, status: Processing, Needs review, Approved, Failed) with filters. Upload area (drag and drop or click; images PNG/JPG and PDF up to 10 MB). A prominent "Try a sample document" button with 3 bundled fictional samples (see below) so a visitor can test without their own files.
2. **Review** (/documents/:id): the document image on the left (zoomable), extracted fields on the right. Each field shows its value, a confidence badge (high ≥ 0.9 green, medium 0.75–0.9 amber, low < 0.75 red) and is editable. Line items in an editable table (description, qty, unit price, amount). A "Validation" panel lists rule results (pass/fail with explanation). Buttons: Approve, Save draft, Re-extract, Delete. Approving stores the final values and records which fields the reviewer changed.
3. **Export**: choose date range / status = Approved, preview the rows, download CSV (one row per document; a second CSV option with one row per line item).
4. **Accuracy**: for approved documents, field-level accuracy = fields the reviewer did not change ÷ total fields, shown per field (bar chart) and overall; also share of documents auto-approvable (all fields high confidence and all rules pass); average processing time.
5. **About this project** (common requirements).

## Extraction (edge function, Lovable AI vision model, structured output)
Schema: document_type (Sales Invoice / Official Receipt / Delivery Receipt / Other), vendor_name, vendor_tin, vendor_address, buyer_name, invoice_number, invoice_date (ISO), currency (default PHP), vatable_sales, vat_amount, vat_exempt_sales, total_amount, line_items[] {description, quantity, unit_price, amount}; every top-level field with a confidence 0–1. For PDFs, render the first page to an image in the browser (pdf.js) before sending.

## Validation rules (computed in code, not by the model)
- Sum of line item amounts equals vatable_sales + vat_exempt_sales (±1.00).
- vatable_sales + vat_amount + vat_exempt_sales equals total_amount (±1.00).
- vat_amount ≈ 12% of vatable_sales (±1.00).
- vendor_tin matches ###-###-###-### (last group may be 3–5 digits).
- invoice_date is a valid date not in the future.
- Any field with confidence < 0.75 or any failed rule → status "Needs review"; otherwise "Approved" automatically only if the user enables "Auto-approve clean documents" (setting, off by default) — else "Needs review".

## Bundled samples (fictional, generate as clean, realistic invoice images — e.g., SVG files rendered to PNG in the browser before extraction)
1. "Sari-Sari Supplies Trading (fictional)" Sales Invoice: TIN 123-456-789-00000, 4 line items (bond paper reams, ballpens, folders, printer ink), VAT 12%, all totals consistent.
2. "Kusina ni Lola Catering (fictional)" Official Receipt: VAT-exempt sales, 2 line items, totals consistent.
3. "Mabilis Hardware (fictional)" Sales Invoice with a deliberate arithmetic error: the total printed is PHP 100.00 higher than vatable + VAT, so the "totals" rule must fail and the document lands in Needs review.

## Acceptance checks
- D1 "Try a sample" for sample 1 produces extracted fields matching the image (vendor, TIN, invoice number, date, totals, 4 line items) and all rules pass.
- D2 Sample 3 fails the totals rule and shows status Needs review with a clear explanation.
- D3 Editing a field on Review and approving records the change; the Accuracy page reflects it (that field's accuracy drops below 100%).
- D4 Export downloads a CSV with the approved documents' values.
- D5 Uploading a PNG works end to end (QA may use a screenshot of a sample).
- D6 Low-confidence fields show the red/amber badges; errors (e.g., unreadable image) show a Failed status with a retry, not a stuck spinner.
- D7 Reset demo data, About page, mobile layout, no console errors.

# Common requirements for all five portfolio apps (append to every Lovable spec)

These apps are portfolio pieces for Uriel Papa, who is applying for AI Solutions Engineer / Forward-Deployed Engineer roles. A hiring manager will open the published link and click around with no login and no setup. Everything must work on first visit.

## Stack and backend
- Use Lovable Cloud for the database, file storage and edge functions.
- Use Lovable AI (Lovable's built-in AI gateway) for every model call. Do not ask for, or depend on, any external API key (no OpenAI/Anthropic/OpenRouter keys).
- All model calls happen in edge functions, never in the browser.
- No login. This is a public demo. Keep Row Level Security enabled on every table, with policies that let the demo work (anonymous read of demo data; writes go through edge functions or narrowly scoped anon policies). The project must pass Lovable's security scan so it can be published.
- Handle AI errors visibly: show a friendly error toast/message on rate limits (429), credits (402) or timeouts, never a blank screen or a spinner that never ends.

## Demo data
- Seed realistic sample data on first load (or via a migration) so every screen has content immediately. All sample businesses, people and documents are fictional and labeled as such.
- Add a "Reset demo data" action (with confirm) that restores the seed state.
- Show a slim banner: "Demo app — all sample data is fictional."

## Portfolio framing
- Add an "About this project" page reachable from the nav with four short sections: The problem (who has it, what it costs), The approach (how the app solves it, the AI pattern used), Architecture (frontend → edge functions → Lovable AI → database; list tables and functions), What I'd do next in a real deployment. Author: Uriel Papa, with links to github.com/Edamuza and linkedin.com/in/uriel-papa-vitese01.
- Clean, professional, responsive UI (works at 375px phone width and on desktop). Consistent nav. Empty states, loading states and error states for every async action.

## Quality bar
- No console errors on load. No broken routes. Every button does something real.
- Numbers shown in tables/KPIs must be computed from stored data, not hard-coded.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://docusift-uriel.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9131025b-9e9c-497e-953f-76c72a706ed4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
