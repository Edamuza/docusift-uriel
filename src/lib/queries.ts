import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Confidence, DocData, DocStatus } from "./doc-schema";

export type DocRow = {
  id: string;
  file_name: string;
  image_url: string | null;
  status: DocStatus;
  extracted: DocData | null;
  data: DocData | null;
  confidence: Confidence;
  changed_fields: string[];
  processing_ms: number | null;
  error: string | null;
  is_seed: boolean;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
};

export const documentsQuery = queryOptions({
  queryKey: ["documents"],
  queryFn: async () => {
    const { data, error } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as DocRow[];
  },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const documentQuery = (id: string) =>
  queryOptions({
    queryKey: ["documents", id],
    queryFn: async () => {
      if (!UUID_RE.test(id)) return null;
      const { data, error } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as unknown as DocRow | null;
    },
  });

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("app_settings").select("auto_approve").eq("id", 1).maybeSingle();
    if (error) throw new Error(error.message);
    return { auto_approve: data?.auto_approve ?? false };
  },
});
