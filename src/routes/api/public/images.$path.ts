import { createFileRoute } from "@tanstack/react-router";

// Serves uploaded document images from private storage. Public demo: images are
// fictional/sample uploads and are only addressable by their random UUID file name.
export const Route = createFileRoute("/api/public/images/$path")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(params.path)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("uploads").download(params.path);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data, {
          headers: { "content-type": data.type || "image/jpeg", "cache-control": "public, max-age=31536000, immutable" },
        });
      },
    },
  },
});
