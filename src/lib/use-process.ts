import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createDocument, extractDocument } from "./docs.functions";
import { STATUS_LABELS } from "./doc-schema";

/** Create a document from a rendered image and run extraction, with toasts for every outcome. */
export function useProcessDocument() {
  const qc = useQueryClient();
  const create = useServerFn(createDocument);
  const extract = useServerFn(extractDocument);

  const runExtraction = async (id: string, imageDataUrl: string) => {
    await qc.invalidateQueries({ queryKey: ["documents"] });
    try {
      const res = await extract({ data: { id, imageDataUrl } });
      if (res.ok) toast.success(`Extracted — ${STATUS_LABELS[res.status]}`);
      else toast.error(res.error);
    } catch {
      toast.error("Extraction failed. Please retry.");
    } finally {
      await qc.invalidateQueries({ queryKey: ["documents"] });
    }
  };

  const process = async (fileName: string, imageDataUrl: string) => {
    const { id } = await create({ data: { fileName, imageDataUrl } });
    await runExtraction(id, imageDataUrl);
    return id;
  };

  return { process, runExtraction };
}
