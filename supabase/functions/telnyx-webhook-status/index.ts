import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

async function requireAdmin(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userRes, error } = await userClient.auth.getUser();
  if (error || !userRes?.user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: caller } = await admin
    .from("users")
    .select("role, status")
    .eq("id", userRes.user.id)
    .maybeSingle();

  if (!caller || caller.status !== "active" || caller.role !== "admin") {
    return json({ error: "Forbidden" }, 403);
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const denied = await requireAdmin(req);
  if (denied) return denied;

  const projectUrl = Deno.env.get("SUPABASE_URL")!;
  const expected = {
    inbound: `${projectUrl}/functions/v1/telnyx-inbound-sms`,
    delivery: `${projectUrl}/functions/v1/telnyx-delivery-status`,
  };

  const apiKey = Deno.env.get("TELNYX_API_KEY");
  if (!apiKey) {
    return json({
      configured: false,
      apiKeyPresent: false,
      expected,
      profiles: [],
      error: "TELNYX_API_KEY is not configured for this project.",
    });
  }

  try {
    const res = await fetch("https://api.telnyx.com/v2/messaging_profiles?page[size]=50", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const body = await res.json();

    if (!res.ok) {
      const first = body?.errors?.[0] ?? {};
      return json({
        configured: false,
        apiKeyPresent: true,
        expected,
        profiles: [],
        error: [first.code ? `Telnyx ${first.code}` : `HTTP ${res.status}`, first.title, first.detail]
          .filter(Boolean)
          .join(": "),
      });
    }

    const profiles = (body?.data ?? []).map((p: any) => {
      const inboundUrl: string = p.webhook_url ?? "";
      const failoverUrl: string = p.webhook_failover_url ?? "";
      const inboundOk = inboundUrl.trim() === expected.inbound;
      // Telnyx sends both inbound + delivery events to webhook_url; the failover
      // URL is where we point the delivery-status handler.
      const deliveryOk =
        failoverUrl.trim() === expected.delivery || inboundUrl.trim() === expected.delivery;
      return {
        id: p.id,
        name: p.name,
        enabled: p.enabled !== false,
        webhookUrl: inboundUrl || null,
        webhookFailoverUrl: failoverUrl || null,
        webhookApiVersion: p.webhook_api_version ?? null,
        inboundOk,
        deliveryOk,
      };
    });

    const configured = profiles.some((p: any) => p.enabled && p.inboundOk && p.deliveryOk);

    return json({ configured, apiKeyPresent: true, expected, profiles });
  } catch (e: any) {
    return json({
      configured: false,
      apiKeyPresent: true,
      expected,
      profiles: [],
      error: e?.message ?? "Failed to reach the Telnyx API",
    });
  }
});
