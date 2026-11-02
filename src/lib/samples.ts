// Fictional bundled sample documents. SVGs in public/samples are generated from this data
// by scripts/gen-samples.ts so the image and the expected values never drift apart.
import type { DocData } from "./doc-schema";

export type Sample = {
  slug: string;
  title: string;
  blurb: string;
  data: DocData;
  printedTotal: number;
};

export const SAMPLES: Sample[] = [
  {
    slug: "sari-sari-supplies",
    title: "Sari-Sari Supplies Trading",
    blurb: "Sales invoice · 4 items · VAT 12% · clean",
    printedTotal: 5062.4,
    data: {
      document_type: "Sales Invoice",
      vendor_name: "Sari-Sari Supplies Trading (fictional)",
      vendor_tin: "123-456-789-00000",
      vendor_address: "123 Rizal Avenue, Sta. Cruz, Manila",
      buyer_name: "Dela Cruz Accounting Services (fictional)",
      invoice_number: "0001245",
      invoice_date: "2026-10-14",
      currency: "PHP",
      vatable_sales: 4520,
      vat_amount: 542.4,
      vat_exempt_sales: 0,
      total_amount: 5062.4,
      line_items: [
        { description: "Bond paper A4, ream", quantity: 10, unit_price: 250, amount: 2500 },
        { description: "Ballpens, box of 12", quantity: 5, unit_price: 120, amount: 600 },
        { description: "Folders, long, pack of 10", quantity: 4, unit_price: 95, amount: 380 },
        { description: "Printer ink, black", quantity: 2, unit_price: 520, amount: 1040 },
      ],
    },
  },
  {
    slug: "kusina-ni-lola",
    title: "Kusina ni Lola Catering",
    blurb: "Official receipt · VAT-exempt · clean",
    printedTotal: 5300,
    data: {
      document_type: "Official Receipt",
      vendor_name: "Kusina ni Lola Catering (fictional)",
      vendor_tin: "234-567-890-000",
      vendor_address: "45 Mabini Street, Malolos, Bulacan",
      buyer_name: "Barangay San Isidro Council (fictional)",
      invoice_number: "004512",
      invoice_date: "2026-10-20",
      currency: "PHP",
      vatable_sales: 0,
      vat_amount: 0,
      vat_exempt_sales: 5300,
      total_amount: 5300,
      line_items: [
        { description: "Pancit party tray", quantity: 3, unit_price: 1200, amount: 3600 },
        { description: "Kakanin bilao", quantity: 2, unit_price: 850, amount: 1700 },
      ],
    },
  },
  {
    slug: "mabilis-hardware",
    title: "Mabilis Hardware",
    blurb: "Sales invoice · total is PHP 100 too high",
    printedTotal: 11199.2,
    data: {
      document_type: "Sales Invoice",
      vendor_name: "Mabilis Hardware (fictional)",
      vendor_tin: "345-678-901-0000",
      vendor_address: "88 Quezon Boulevard, Quezon City",
      buyer_name: "Reyes Construction (fictional)",
      invoice_number: "0007781",
      invoice_date: "2026-10-25",
      currency: "PHP",
      vatable_sales: 9910,
      vat_amount: 1189.2,
      vat_exempt_sales: 0,
      total_amount: 11199.2,
      line_items: [
        { description: "Portland cement, 40kg bag", quantity: 10, unit_price: 265, amount: 2650 },
        { description: "Rebar 10mm x 6m", quantity: 20, unit_price: 185, amount: 3700 },
        { description: "Marine plywood 1/2in", quantity: 5, unit_price: 640, amount: 3200 },
        { description: "Common nails, kg", quantity: 4, unit_price: 90, amount: 360 },
      ],
    },
  },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${months[m - 1]} ${d}, ${y}`;
}

export function sampleSvg(s: Sample): string {
  const d = s.data;
  const W = 850, H = 1100;
  const ink = "#1f2933", soft = "#52606d", line = "#9aa5b1", accent = s.slug === "kusina-ni-lola" ? "#7c2d12" : s.slug === "mabilis-hardware" ? "#1e3a8a" : "#14532d";
  const isOR = d.document_type === "Official Receipt";
  const rows = d.line_items
    .map((li, i) => {
      const y = 520 + i * 44;
      return `<text x="70" y="${y}" font-size="18" fill="${ink}">${esc(li.description)}</text>
<text x="500" y="${y}" font-size="18" text-anchor="end" fill="${ink}">${li.quantity}</text>
<text x="640" y="${y}" font-size="18" text-anchor="end" fill="${ink}">${money(li.unit_price ?? 0)}</text>
<text x="780" y="${y}" font-size="18" text-anchor="end" fill="${ink}">${money(li.amount ?? 0)}</text>
<line x1="60" y1="${y + 16}" x2="790" y2="${y + 16}" stroke="#e4e7eb"/>`;
    })
    .join("\n");
  const sy = 520 + d.line_items.length * 44 + 40;
  const summary = [
    ["VATable Sales", d.vatable_sales ?? 0],
    ["VAT-Exempt Sales", d.vat_exempt_sales ?? 0],
    ["VAT (12%)", d.vat_amount ?? 0],
  ]
    .map(
      ([k, v], i) => `<text x="600" y="${sy + i * 34}" font-size="18" text-anchor="end" fill="${soft}">${k}</text>
<text x="780" y="${sy + i * 34}" font-size="18" text-anchor="end" fill="${ink}">${money(v as number)}</text>`,
    )
    .join("\n");
  const ty = sy + 3 * 34 + 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">
<rect width="${W}" height="${H}" fill="#fffdf8"/>
<rect x="30" y="30" width="${W - 60}" height="${H - 60}" fill="none" stroke="${line}" stroke-width="1.5"/>
<text x="${W / 2}" y="95" font-size="30" font-weight="700" text-anchor="middle" fill="${accent}">${esc(d.vendor_name ?? "")}</text>
<text x="${W / 2}" y="128" font-size="17" text-anchor="middle" fill="${soft}">${esc(d.vendor_address ?? "")}</text>
<text x="${W / 2}" y="154" font-size="17" text-anchor="middle" fill="${soft}">${isOR ? "VAT-Exempt" : "VAT Reg."} TIN: ${esc(d.vendor_tin ?? "")}</text>
<rect x="60" y="185" width="${W - 120}" height="52" fill="${accent}"/>
<text x="${W / 2}" y="220" font-size="26" font-weight="700" text-anchor="middle" fill="#ffffff" letter-spacing="4">${esc((d.document_type ?? "").toUpperCase())}</text>
<text x="70" y="290" font-size="18" fill="${soft}">${isOR ? "OR No." : "SI No."}</text>
<text x="170" y="290" font-size="22" font-weight="700" fill="#b91c1c">${esc(d.invoice_number ?? "")}</text>
<text x="520" y="290" font-size="18" fill="${soft}">Date:</text>
<text x="580" y="290" font-size="20" fill="${ink}">${longDate(d.invoice_date ?? "2026-01-01")}</text>
<text x="70" y="345" font-size="18" fill="${soft}">Sold to:</text>
<text x="160" y="345" font-size="20" fill="${ink}">${esc(d.buyer_name ?? "")}</text>
<line x1="160" y1="352" x2="790" y2="352" stroke="${line}"/>
<text x="70" y="390" font-size="18" fill="${soft}">Terms:</text>
<text x="160" y="390" font-size="20" fill="${ink}">Cash</text>
<rect x="60" y="440" width="${W - 120}" height="44" fill="#f0f4f8"/>
<text x="70" y="469" font-size="17" font-weight="700" fill="${ink}">DESCRIPTION</text>
<text x="500" y="469" font-size="17" font-weight="700" text-anchor="end" fill="${ink}">QTY</text>
<text x="640" y="469" font-size="17" font-weight="700" text-anchor="end" fill="${ink}">UNIT PRICE</text>
<text x="780" y="469" font-size="17" font-weight="700" text-anchor="end" fill="${ink}">AMOUNT</text>
${rows}
${summary}
<line x1="420" y1="${ty - 26}" x2="790" y2="${ty - 26}" stroke="${ink}" stroke-width="1.5"/>
<text x="600" y="${ty + 4}" font-size="22" font-weight="700" text-anchor="end" fill="${ink}">TOTAL AMOUNT DUE</text>
<text x="780" y="${ty + 4}" font-size="22" font-weight="700" text-anchor="end" fill="${ink}">PHP ${money(s.printedTotal)}</text>
<line x1="500" y1="${H - 150}" x2="780" y2="${H - 150}" stroke="${line}"/>
<text x="640" y="${H - 125}" font-size="15" text-anchor="middle" fill="${soft}">Authorized Signature</text>
<text x="${W / 2}" y="${H - 70}" font-size="14" text-anchor="middle" fill="${soft}">FICTIONAL SAMPLE DOCUMENT — FOR DEMONSTRATION ONLY</text>
</svg>`;
}
