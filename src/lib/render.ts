// Browser-only helpers: turn an uploaded file / sample URL into a JPEG data URL for extraction.
const MAX_SIDE = 1800;

function canvasToDataUrl(canvas: HTMLCanvasElement) {
  return canvas.toDataURL("image/jpeg", 0.9);
}

function drawScaled(src: CanvasImageSource, w: number, h: number) {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return canvasToDataUrl(c);
}

export async function urlToJpeg(url: string): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  // SVGs may report 0 natural size in some browsers; fall back to letter size.
  const w = img.naturalWidth || 850;
  const h = img.naturalHeight || 1100;
  // Render SVGs at 2x for sharper text.
  if (url.endsWith(".svg")) {
    const c = document.createElement("canvas");
    c.width = Math.min(w * 2, MAX_SIDE);
    c.height = Math.round((c.width / w) * h);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return canvasToDataUrl(c);
  }
  return drawScaled(img, w, h);
}

async function pdfToJpeg(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2.5, MAX_SIDE / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvasToDataUrl(canvas);
}

export const ACCEPTED = ["image/png", "image/jpeg", "application/pdf"];
export const MAX_BYTES = 10 * 1024 * 1024;

export async function fileToJpeg(file: File): Promise<string> {
  if (file.type === "application/pdf") return pdfToJpeg(file);
  const url = URL.createObjectURL(file);
  try {
    return await urlToJpeg(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
