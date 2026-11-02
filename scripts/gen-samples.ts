import { writeFileSync } from "node:fs";
import { SAMPLES, sampleSvg, type Sample } from "../src/lib/samples";
const extra: Sample = { slug: "bayanihan-office-depot", title: "Bayanihan Office Depot", blurb: "", printedTotal: 1803.2, data: {
  document_type: "Sales Invoice", vendor_name: "Bayanihan Office Depot (fictional)", vendor_tin: "456-789-012-00000",
  vendor_address: "12 Colon Street, Cebu City", buyer_name: "Santos Dental Clinic (fictional)", invoice_number: "0003310",
  invoice_date: "2026-09-30", currency: "PHP", vatable_sales: 1610, vat_amount: 193.2, vat_exempt_sales: 0, total_amount: 1803.2,
  line_items: [{ description: "Heavy-duty stapler", quantity: 3, unit_price: 350, amount: 1050 }, { description: "Whiteboard markers, box", quantity: 2, unit_price: 280, amount: 560 }] } };
for (const s of [...SAMPLES, extra]) writeFileSync(`public/samples/${s.slug}.svg`, sampleSvg(s));
