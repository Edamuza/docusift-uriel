import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, APICallError, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { DOC_TYPES, TOP_FIELDS, type Confidence, type DocData } from "./doc-schema";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const RUN_ID = "X-Lovable-AIG-Run-ID";

const str = z.object({ value: z.string().nullable(), confidence: z.number() });
const num = z.object({ value: z.number().nullable(), confidence: z.number() });

const schema = z.object({
  readable: z.boolean(),
  document_type: z.object({ value: z.enum(DOC_TYPES), confidence: z.number() }),
  vendor_name: str,
  vendor_tin: str,
  vendor_address: str,
  buyer_name: str,
  invoice_number: str,
  invoice_date: str,
  currency: str,
  vatable_sales: num,
  vat_amount: num,
  vat_exempt_sales: num,
  total_amount: num,
  line_items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().nullable(),
      unit_price: z.number().nullable(),
      amount: z.number().nullable(),
    }),
  ),
  line_items_confidence: z.number(),
});

const INSTRUCTIONS = `You extract structured data from Philippine invoices and official receipts (BIR format).
Rules:
- Copy values exactly as printed. Do not correct arithmetic errors; report the printed numbers.
- invoice_date must be ISO YYYY-MM-DD. vendor_tin keeps dashes as printed (e.g. 123-456-789-00000).
- currency defaults to "PHP" when amounts are in pesos or no currency is shown.
- Amounts are plain numbers without commas or symbols. Use 0 for VATable/VAT/VAT-exempt lines that are blank or zero on the document; null only if the field is entirely absent.
- invoice_number is the SI / OR / DR number.
- confidence (0 to 1) reflects how legible and certain each value is; use below 0.75 when guessing.
- If the image is not an invoice/receipt or is unreadable, set readable=false and all values null with confidence 0.`;

export class ExtractionError extends Error {
  constructor(message: string, public code: "rate_limit" | "credits" | "unreadable" | "ai_error") {
    super(message);
  }
}

export async function extractFromImage(imageDataUrl: string): Promise<{ data: DocData; confidence: Confidence }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new ExtractionError("AI is not configured on the server.", "ai_error");
  let runId: string | undefined;
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set(RUN_ID, runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get(RUN_ID) ?? undefined;
      return res;
    },
  });

  let streamError: unknown;
  try {
    const result = streamText({
      model: provider.responses(MODEL),
      instructions: INSTRUCTIONS,
      maxRetries: 0,
      output: Output.object({ schema }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract every field from this document." },
            { type: "image", image: new URL(imageDataUrl) },
          ],
        },
      ],
      onError: ({ error }) => {
        streamError = error;
      },
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const out = await result.output;
    if (!out.readable) throw new ExtractionError("The image could not be read as an invoice or receipt.", "unreadable");
    const data = { line_items: out.line_items } as DocData;
    const confidence: Confidence = { line_items: clamp(out.line_items_confidence) };
    for (const f of TOP_FIELDS) {
      (data as Record<string, unknown>)[f] = out[f].value;
      confidence[f] = clamp(out[f].confidence);
    }
    if (!data.currency) data.currency = "PHP";
    return { data, confidence };
  } catch (e) {
    if (e instanceof ExtractionError) throw e;
    const err = streamError ?? e;
    const status = APICallError.isInstance(err) ? err.statusCode : undefined;
    console.error("extraction failed", status, err);
    if (status === 429) throw new ExtractionError("The AI service is busy (rate limited). Please retry in a minute.", "rate_limit");
    if (status === 402 || status === 403)
      throw new ExtractionError("AI credits are exhausted for this workspace. Please try again later.", "credits");
    if (NoObjectGeneratedError.isInstance(e))
      throw new ExtractionError("The AI could not produce structured data for this image.", "unreadable");
    throw new ExtractionError("Extraction failed due to an AI service error. Please retry.", "ai_error");
  }
}

const clamp = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
