import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { decodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Verifies the Telnyx webhook ed25519 signature. */
async function verifyTelnyxSignature(rawBody: string, req: Request): Promise<boolean> {
  const publicKeyB64 = Deno.env.get("TELNYX_PUBLIC_KEY");
  if (!publicKeyB64) {
    console.error("TELNYX_PUBLIC_KEY not configured");
    return false;
  }
  const signatureB64 = req.headers.get("telnyx-signature-ed25519");
  const timestamp = req.headers.get("telnyx-timestamp");
  if (!signatureB64 || !timestamp) return false;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      decodeBase64(publicKeyB64),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "Ed25519",
      key,
      decodeBase64(signatureB64),
      new TextEncoder().encode(`${timestamp}|${rawBody}`),
    );
  } catch (err) {
    console.error("Telnyx signature verification error", err);
    return false;
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

/**
 * Telnyx delivery receipt (DLR) webhook. Updates message_send_logs with the
 * carrier delivery status for the matching provider message id.
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const rawBody = await req.text();
  if (!(await verifyTelnyxSignature(rawBody, req))) {
    return json({ error: "Invalid signature" }, 401);
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const event = body?.data;
  const eventType: string = event?.event_type ?? "";
  if (!eventType.startsWith("message.")) {
    return json({ ok: true, ignored: true });
  }

  const payload = event?.payload ?? {};
  const providerId: string | undefined = payload?.id;
  if (!providerId) return json({ ok: true, no_action: true });

  const to = Array.isArray(payload.to) ? payload.to[0] : null;
  const carrierStatus: string = to?.status ?? payload?.status ?? eventType;
  const errors = Array.isArray(payload.errors) ? payload.errors : [];
  const errorDetail = errors.length
    ? errors.map((e: any) => `${e.code ?? ""} ${e.title ?? ""} ${e.detail ?? ""}`.trim()).join("; ")
    : null;

  const delivered = carrierStatus === "delivered";
  const failed = ["delivery_failed", "sending_failed", "failed", "expired"].includes(carrierStatus);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const update: Record<string, unknown> = {
      delivery_status: delivered ? "delivered" : failed ? "undelivered" : carrierStatus,
      provider_status_detail: errorDetail ?? carrierStatus,
    };
    if (delivered) update.delivered_at = new Date().toISOString();
    if (failed && errorDetail) update.error_detail = errorDetail;

    const { error } = await admin
      .from("message_send_logs")
      .update(update)
      .eq("provider_message_id", providerId);

    if (error) console.error("Failed to update delivery status", error);
  } catch (err) {
    console.error("telnyx-delivery-status error", err);
  }

  return json({ ok: true });
});
