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

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type MailjetEvent = {
  event?: string;
  MessageID?: number | string;
  time?: number;
  error?: string;
  error_related_to?: string;
  comment?: string;
};

/**
 * Mailjet event webhook (sent / open / click / bounce / blocked / spam).
 * Configure the Mailjet event URL as:
 *   https://<project>.supabase.co/functions/v1/mailjet-events?s=<MAILJET_WEBHOOK_SECRET>
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const secret = Deno.env.get("MAILJET_WEBHOOK_SECRET");
  const provided = new URL(req.url).searchParams.get("s") || "";
  if (!secret || !timingSafeEqual(secret, provided)) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const events: MailjetEvent[] = Array.isArray(body) ? body : [body as MailjetEvent];

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let applied = 0;
  for (const ev of events) {
    const providerId = ev?.MessageID != null ? String(ev.MessageID) : null;
    const type = (ev?.event || "").toLowerCase();
    if (!providerId || !type) continue;

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {};

    if (type === "sent") {
      update.delivery_status = "delivered";
      update.delivered_at = now;
      update.provider_status_detail = "accepted by recipient server";
    } else if (type === "open" || type === "click") {
      update.delivery_status = "opened";
      update.last_open_at = now;
      update.provider_status_detail = type === "click" ? "link clicked" : "email opened";
    } else if (["bounce", "blocked", "spam", "unsub"].includes(type)) {
      update.delivery_status = type === "unsub" ? "unsubscribed" : "undelivered";
      update.provider_status_detail = [ev.error_related_to, ev.error, ev.comment]
        .filter(Boolean)
        .join(" - ") || type;
    } else {
      continue;
    }

    if (type === "open" || type === "click") {
      const { data: row } = await admin
        .from("message_send_logs")
        .select("id, open_count, opened_at")
        .eq("provider_message_id", providerId)
        .maybeSingle();
      if (!row) continue;
      update.opened_at = (row as any).opened_at ?? now;
      update.open_count = (((row as any).open_count as number) ?? 0) + 1;
      const { error } = await admin.from("message_send_logs").update(update).eq("id", (row as any).id);
      if (!error) applied++;
      continue;
    }

    const { error } = await admin
      .from("message_send_logs")
      .update(update)
      .eq("provider_message_id", providerId);
    if (!error) applied++;
  }

  return json({ ok: true, received: events.length, applied });
});
