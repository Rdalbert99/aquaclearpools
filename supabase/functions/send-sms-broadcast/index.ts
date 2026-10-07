import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELNYX_API_URL = "https://api.telnyx.com/v2/messages";
const FROM_NUMBER = "+16014198527"; // existing Aqua Clear Telnyx number
const MAX_SEGMENTS = 10;
const SEND_INTERVAL_MS = 1100; // long-code numbers are limited to ~1 message/second

const GSM_BASIC =
  "@\u00a3$\u00a5\u00e8\u00e9\u00f9\u00ec\u00f2\u00c7\n\u00d8\u00f8\r\u00c5\u00e5\u0394_\u03a6\u0393\u039b\u03a9\u03a0\u03a8\u03a3\u0398\u039e\u00c6\u00e6\u00df\u00c9 !\"#\u00a4%&'()*+,-./0123456789:;<=>?" +
  "\u00a1ABCDEFGHIJKLMNOPQRSTUVWXYZ\u00c4\u00d6\u00d1\u00dc\u00a7\u00bfabcdefghijklmnopqrstuvwxyz\u00e4\u00f6\u00f1\u00fc\u00e0";
const GSM_EXTENDED = "^{}\\[~]|\u20ac";

function analyze(text: string) {
  const chars = Array.from(text);
  const isGsm = chars.every((c) => GSM_BASIC.includes(c) || GSM_EXTENDED.includes(c));
  const units = isGsm
    ? chars.reduce((n, c) => n + (GSM_EXTENDED.includes(c) ? 2 : 1), 0)
    : chars.reduce((n, c) => n + ((c.codePointAt(0) ?? 0) > 0xffff ? 2 : 1), 0);
  const single = isGsm ? 160 : 70;
  const multi = isGsm ? 153 : 67;
  const segments = units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / multi);
  return { segments, encoding: isGsm ? "GSM-7" : "UCS-2" };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mask(p: string) {
  return p.length > 4 ? `${p.slice(0, -4).replace(/\d/g, "*")}${p.slice(-4)}` : p;
}

function normalize(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const hadPlus = t.startsWith("+");
  let d = t.replace(/\D/g, "");
  if (!hadPlus && d.length === 10) d = "1" + d;
  if (d.length < 11 || d.length > 15) return null;
  if (d.length === 11 && d.startsWith("1")) {
    if (d[1] < "2" || d[4] < "2") return null;
  }
  return "+" + d;
}

function splitPhones(raw: string | null): string[] {
  return String(raw ?? "")
    .split(/[,;/\n]+|\s+(?:and|or|&)\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

type Recipient = { phone: string; client_id: string; client_name: string };

// Audience resolution lives here so new groups can be added as extra cases.
async function resolveAudience(admin: any, audience: string) {
  if (audience !== "all_active") throw new Error("Unknown audience");
  const { data: clients, error } = await admin
    .from("clients")
    .select("id, customer, contact_phone, status, notification_method")
    .eq("status", "active");
  if (error) throw error;
  const { data: optOuts } = await admin.from("sms_opt_outs").select("phone");
  const blocked = new Set((optOuts ?? []).map((o: any) => o.phone));

  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  let invalid = 0;
  let optedOut = 0;
  for (const c of clients ?? []) {
    if (String(c.notification_method ?? "").toLowerCase() === "none") { optedOut++; continue; }
    const phones = splitPhones(c.contact_phone).map(normalize).filter(Boolean) as string[];
    if (phones.length === 0) { invalid++; continue; }
    let added = false;
    let allBlocked = true;
    for (const p of phones) {
      if (blocked.has(p)) continue;
      allBlocked = false;
      if (seen.has(p)) continue;
      seen.add(p);
      recipients.push({ phone: p, client_id: c.id, client_name: c.customer });
      added = true;
    }
    if (!added && allBlocked) optedOut++;
  }
  return { recipients, invalid, optedOut, activeClients: clients?.length ?? 0 };
}

async function sendOne(apiKey: string, to: string, text: string) {
  try {
    const res = await fetch(TELNYX_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_NUMBER, to, text }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = body?.errors?.[0] ?? {};
      return {
        ok: false,
        code: e.code ? String(e.code) : `HTTP ${res.status}`,
        detail: [e.title, e.detail].filter(Boolean).join(": ") || `Telnyx HTTP ${res.status}`,
      };
    }
    return { ok: true, id: body?.data?.id ?? null };
  } catch (err: any) {
    return { ok: false, code: "network", detail: String(err?.message ?? err).slice(0, 300) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: u, error: uErr } = await userClient.auth.getUser();
  if (uErr || !u?.user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(url, service);
  const { data: caller } = await admin
    .from("users").select("id, name, role, status").eq("id", u.user.id).maybeSingle();
  if (!caller || caller.role !== "admin" || caller.status !== "active") {
    return json({ error: "Only admins can send broadcasts" }, 403);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const mode = body?.mode;
  const audience = typeof body?.audience === "string" ? body.audience : "all_active";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!["preview", "test", "send"].includes(mode)) return json({ error: "Invalid mode" }, 400);

  if (mode === "preview") {
    try {
      const a = await resolveAudience(admin, audience);
      return json({
        recipientCount: a.recipients.length,
        activeClients: a.activeClients,
        excludedInvalid: a.invalid,
        excludedOptOut: a.optedOut,
      });
    } catch (e: any) {
      console.error("preview failed", e);
      return json({ error: "Could not load recipients" }, 500);
    }
  }

  if (!message || message.length > 1600) return json({ error: "Message must be 1–1600 characters" }, 400);
  const info = analyze(message);
  if (info.segments > MAX_SEGMENTS) return json({ error: `Message is too long (${info.segments} parts, max ${MAX_SEGMENTS})` }, 400);

  const apiKey = Deno.env.get("TELNYX_API_KEY");
  if (!apiKey) return json({ error: "Texting is not configured on the server" }, 500);

  const templateId = typeof body?.templateId === "string" ? body.templateId : null;
  const templateName = typeof body?.templateName === "string" ? body.templateName.slice(0, 100) : null;

  if (mode === "test") {
    const to = normalize(String(body?.testNumber ?? ""));
    if (!to) return json({ error: "Enter a valid test phone number" }, 400);
    const { data: b, error: bErr } = await admin.from("sms_broadcasts").insert({
      sent_by: caller.id, sent_by_name: caller.name, template_id: templateId, template_name: templateName,
      message, audience: "test", is_test: true, intended_count: 1, segments: info.segments, encoding: info.encoding,
    }).select("id").single();
    if (bErr) { console.error(bErr); return json({ error: "Could not record test" }, 500); }
    const r = await sendOne(apiKey, to, message);
    if (!r.ok) console.error("test send failed", r.code, r.detail);
    await admin.from("sms_broadcast_recipients").insert({
      broadcast_id: b.id, phone_masked: mask(to), client_name: "Test number",
      status: r.ok ? "sent" : "failed", provider_message_id: (r as any).id ?? null,
      error_code: (r as any).code ?? null, error_detail: (r as any).detail ?? null,
    });
    await admin.from("sms_broadcasts").update({
      status: "completed", sent_count: r.ok ? 1 : 0, failed_count: r.ok ? 0 : 1,
      error_summary: r.ok ? null : (r as any).detail, completed_at: new Date().toISOString(),
    }).eq("id", b.id);
    return json({ success: r.ok, error: r.ok ? undefined : (r as any).detail });
  }

  // mode === "send" — requires explicit confirmation and a matching count
  if (body?.confirm !== true) return json({ error: "Confirmation required" }, 400);
  const expected = Number(body?.expectedCount);
  let a;
  try { a = await resolveAudience(admin, audience); } catch (e) {
    console.error(e); return json({ error: "Could not load recipients" }, 500);
  }
  if (a.recipients.length === 0) return json({ error: "No eligible recipients" }, 400);
  if (expected !== a.recipients.length) {
    return json({ error: `Recipient count changed (now ${a.recipients.length}). Review and confirm again.`, recipientCount: a.recipients.length }, 409);
  }

  const { data: b, error: bErr } = await admin.from("sms_broadcasts").insert({
    sent_by: caller.id, sent_by_name: caller.name, template_id: templateId, template_name: templateName,
    message, audience, intended_count: a.recipients.length, excluded_opt_out_count: a.optedOut,
    excluded_invalid_count: a.invalid, segments: info.segments, encoding: info.encoding,
  }).select("id").single();
  if (bErr) { console.error(bErr); return json({ error: "Could not record broadcast" }, 500); }

  const run = async () => {
    let sent = 0, failed = 0;
    const errors: Record<string, number> = {};
    for (const r of a.recipients) {
      const res = await sendOne(apiKey, r.phone, message);
      if (res.ok) sent++; else { failed++; const k = (res as any).code ?? "error"; errors[k] = (errors[k] ?? 0) + 1; }
      await admin.from("sms_broadcast_recipients").insert({
        broadcast_id: b.id, client_id: r.client_id, client_name: r.client_name, phone_masked: mask(r.phone),
        status: res.ok ? "sent" : "failed", provider_message_id: (res as any).id ?? null,
        error_code: (res as any).code ?? null, error_detail: (res as any).detail ?? null,
      });
      if ((sent + failed) % 10 === 0) {
        await admin.from("sms_broadcasts").update({ sent_count: sent, failed_count: failed }).eq("id", b.id);
      }
      await new Promise((ok) => setTimeout(ok, SEND_INTERVAL_MS));
    }
    const summary = Object.entries(errors).map(([k, v]) => `${k} ×${v}`).join(", ");
    await admin.from("sms_broadcasts").update({
      status: failed === 0 ? "completed" : sent === 0 ? "failed" : "completed_with_errors",
      sent_count: sent, failed_count: failed, error_summary: summary || null,
      completed_at: new Date().toISOString(),
    }).eq("id", b.id);
    console.log(`Broadcast ${b.id}: ${sent} sent, ${failed} failed`);
  };

  // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(run()); else await run();

  return json({ success: true, broadcastId: b.id, recipientCount: a.recipients.length });
});
