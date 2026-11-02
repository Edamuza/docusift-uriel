import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { changedFields, statusAfterExtraction, validate, type DocData } from "./doc-schema";

const BUCKET = "uploads";
const MAX_DATA_URL = 14_000_000; // ~10 MB binary as base64

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function decodeDataUrl(dataUrl: string) {
  const m = /^data:(image\/(png|jpeg|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("Unsupported image format.");
  const bin = Uint8Array.from(atob(m[3] ?? ""), (c) => c.charCodeAt(0));
  return { type: m[1] ?? "image/jpeg", ext: m[2] === "jpeg" ? "jpg" : (m[2] ?? "jpg"), bytes: bin };
}

const imageInput = z.string().min(20).max(MAX_DATA_URL).startsWith("data:image/");

export const createDocument = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ fileName: z.string().min(1).max(200), imageDataUrl: imageInput }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const id = crypto.randomUUID();
    const img = decodeDataUrl(data.imageDataUrl);
    const path = `${id}.${img.ext}`;
    const up = await db.storage.from(BUCKET).upload(path, img.bytes, { contentType: img.type, upsert: true });
    if (up.error) throw new Error("Could not store the image.");
    const { error } = await db.from("documents").insert({
      id,
      file_name: data.fileName,
      image_url: `/api/public/images/${path}`,
      status: "processing",
    });
    if (error) throw new Error("Could not create the document.");
    return { id };
  });

export const extractDocument = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), imageDataUrl: imageInput }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { extractFromImage, ExtractionError } = await import("./extract.server");
    await db.from("documents").update({ status: "processing", error: null, updated_at: new Date().toISOString() }).eq("id", data.id);
    const started = Date.now();
    try {
      if (!data.imageDataUrl || !data.imageDataUrl.includes(";base64,") || data.imageDataUrl.split(";base64,")[1]!.length < 100)
        throw new ExtractionError("The uploaded image data is missing or empty.", "unreadable");
      const { data: doc, confidence } = await extractFromImage(data.imageDataUrl);
      if ((!doc.line_items || doc.line_items.length === 0) && doc.total_amount == null)
        throw new ExtractionError("No line items or total could be read from this image.", "unreadable");
      const rules = validate(doc);
      const { data: settings } = await db.from("app_settings").select("auto_approve").eq("id", 1).maybeSingle();
      const status = statusAfterExtraction(confidence, rules, settings?.auto_approve ?? false);
      const now = new Date().toISOString();
      await db
        .from("documents")
        .update({
          status,
          extracted: doc,
          data: doc,
          confidence,
          changed_fields: [],
          processing_ms: Date.now() - started,
          error: null,
          updated_at: now,
          approved_at: status === "approved" ? now : null,
        })
        .eq("id", data.id);
      return { ok: true as const, status };
    } catch (e) {
      const message = e instanceof ExtractionError ? e.message : "Extraction failed unexpectedly. Please retry.";
      const code = e instanceof ExtractionError ? e.code : "ai_error";
      await db
        .from("documents")
        .update({ status: "failed", error: message, processing_ms: Date.now() - started, updated_at: new Date().toISOString() })
        .eq("id", data.id);
      return { ok: false as const, error: message, code };
    }
  });

const lineItem = z.object({
  description: z.string().max(500),
  quantity: z.number().nullable(),
  unit_price: z.number().nullable(),
  amount: z.number().nullable(),
});
const docData = z.object({
  document_type: z.string().max(100).nullable(),
  vendor_name: z.string().max(300).nullable(),
  vendor_tin: z.string().max(50).nullable(),
  vendor_address: z.string().max(500).nullable(),
  buyer_name: z.string().max(300).nullable(),
  invoice_number: z.string().max(100).nullable(),
  invoice_date: z.string().max(20).nullable(),
  currency: z.string().max(10).nullable(),
  vatable_sales: z.number().nullable(),
  vat_amount: z.number().nullable(),
  vat_exempt_sales: z.number().nullable(),
  total_amount: z.number().nullable(),
  line_items: z.array(lineItem).max(200),
});

export const saveDocument = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), data: docData, approve: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db.from("documents").select("extracted, status").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("Document not found.");
    if (!row.extracted) throw new Error("This document has not been extracted yet.");
    const final = data.data as DocData;
    const changed = changedFields(row.extracted as unknown as DocData, final);
    const now = new Date().toISOString();
    const patch = data.approve
      ? { data: final, status: "approved", changed_fields: changed, approved_at: now, updated_at: now }
      : { data: final, status: row.status === "approved" ? "needs_review" : row.status, changed_fields: changed, approved_at: null, updated_at: now };
    const up = await db.from("documents").update(patch).eq("id", data.id);
    if (up.error) throw new Error("Could not save the document.");
    return { changed };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row } = await db.from("documents").select("image_url").eq("id", data.id).maybeSingle();
    const path = row?.image_url?.startsWith("/api/public/images/") ? row.image_url.slice("/api/public/images/".length) : null;
    if (path) await db.storage.from(BUCKET).remove([path]);
    const { error } = await db.from("documents").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete the document.");
    return { ok: true };
  });

export const setAutoApprove = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ value: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("app_settings").upsert({ id: 1, auto_approve: data.value });
    if (error) throw new Error("Could not update the setting.");
    return { value: data.value };
  });

export const resetDemo = createServerFn({ method: "POST" }).handler(async () => {
  const db = await admin();
  const { data: files } = await db.storage.from(BUCKET).list("", { limit: 1000 });
  if (files?.length) await db.storage.from(BUCKET).remove(files.map((f) => f.name));
  const { error } = await db.rpc("reset_demo");
  if (error) throw new Error("Could not reset demo data.");
  return { ok: true };
});
