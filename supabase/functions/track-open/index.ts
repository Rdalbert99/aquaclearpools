import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://getaquaclear.com";
// Only these destinations may be redirected to (prevents open-redirect abuse).
const ALLOWED_PATHS = new Set(["/auth/login", "/dashboard", "/"]);

/**
 * Public link-tracking endpoint.
 * A short token is embedded in the completion SMS/email; when the client taps
 * it we record the open on message_send_logs and redirect them to the app.
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = (url.searchParams.get("t") || "").trim();
  const requestedPath = url.searchParams.get("p") || "/auth/login";
  const destination = `${SITE_URL}${ALLOWED_PATHS.has(requestedPath) ? requestedPath : "/auth/login"}`;

  if (token && /^[A-Za-z0-9_-]{6,64}$/.test(token)) {
    try {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data: row } = await admin
        .from("message_send_logs")
        .select("id, open_count, opened_at")
        .eq("track_token", token)
        .maybeSingle();

      if (row) {
        const now = new Date().toISOString();
        await admin
          .from("message_send_logs")
          .update({
            opened_at: (row as any).opened_at ?? now,
            last_open_at: now,
            open_count: (((row as any).open_count as number) ?? 0) + 1,
            last_open_user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
            // An open proves the message reached the client.
            delivery_status: "opened",
          })
          .eq("id", (row as any).id);
      } else {
        console.log("Unknown tracking token");
      }
    } catch (err) {
      console.error("track-open error", err);
    }
  }

  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: destination, "Cache-Control": "no-store" },
  });
});
