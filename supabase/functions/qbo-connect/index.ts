// Read-only QuickBooks Online connection test for Aqua Clear admins.
// Actions (POST, admin JWT): status | start | test.  GET = Intuit OAuth callback.
// Never creates or changes anything in QuickBooks.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { isAllowedReturnUrl, safeDocNumber, summarizeInvoice } from "../_shared/qbo-summary.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const CLIENT_ID = Deno.env.get("QBO_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("QBO_CLIENT_SECRET");
const ENV = (Deno.env.get("QBO_ENVIRONMENT") ?? "production") === "sandbox" ? "sandbox" : "production";
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/qbo-connect`;
const AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const API_BASE = ENV === "sandbox" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com";

const admin = createClient(SUPABASE_URL, SERVICE);

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`QuickBooks sign-in failed [${res.status}]: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

const expiry = (secs: number | undefined) => (secs ? new Date(Date.now() + secs * 1000).toISOString() : null);

async function qboGet(conn: any, path: string) {
  const res = await fetch(`${API_BASE}/v3/company/${conn.realm_id}${path}`, {
    headers: { Authorization: `Bearer ${conn.access_token}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`QBO GET ${path} failed [${res.status}]: ${text}`);
    throw new Error(`QuickBooks request failed [${res.status}]: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

async function freshConnection() {
  const { data: conn } = await admin.from("qbo_connections").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!conn) return null;
  if (new Date(conn.access_expires_at).getTime() - Date.now() > 120_000) return conn;
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: conn.refresh_token });
  const upd = {
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? conn.refresh_token,
    access_expires_at: expiry(t.expires_in)!,
    refresh_expires_at: expiry(t.x_refresh_token_expires_in) ?? conn.refresh_expires_at,
  };
  await admin.from("qbo_connections").update(upd).eq("id", conn.id);
  return { ...conn, ...upd };
}

function redirect(url: string, params: Record<string, string>) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: u.toString() } });
}

async function handleCallback(req: Request) {
  const q = new URL(req.url).searchParams;
  const state = q.get("state") ?? "";
  const { data: st } = await admin.from("qbo_oauth_states").select("*").eq("state", state).maybeSingle();
  if (!st || st.used_at || new Date(st.expires_at) < new Date()) {
    return new Response("This QuickBooks sign-in link expired. Go back to Aqua Clear and start again.", { status: 400 });
  }
  await admin.from("qbo_oauth_states").update({ used_at: new Date().toISOString() }).eq("state", state);
  const back = st.return_url;
  if (q.get("error")) return redirect(back, { qbo: "error", reason: q.get("error")! });
  const code = q.get("code"), realmId = q.get("realmId");
  if (!code || !realmId || !/^\d+$/.test(realmId)) return redirect(back, { qbo: "error", reason: "missing_code" });
  try {
    const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI });
    const row = {
      realm_id: realmId,
      environment: ENV,
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      access_expires_at: expiry(t.expires_in)!,
      refresh_expires_at: expiry(t.x_refresh_token_expires_in),
      connected_by: st.user_id,
    };
    let companyName: string | null = null;
    try {
      const ci = await qboGet(row, `/companyinfo/${realmId}?minorversion=75`);
      companyName = ci?.CompanyInfo?.CompanyName ?? null;
    } catch (e) { console.error("companyinfo after connect failed", e); }
    // One QuickBooks company at a time for this test harness.
    await admin.from("qbo_connections").delete().neq("realm_id", realmId);
    const { error } = await admin.from("qbo_connections").upsert({ ...row, company_name: companyName }, { onConflict: "realm_id" });
    if (error) throw error;
    return redirect(back, { qbo: "connected" });
  } catch (e) {
    console.error("QBO callback error", e);
    return redirect(back, { qbo: "error", reason: "token_exchange_failed" });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") return handleCallback(req);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ error: "Unauthorized" }, 401);
  const { data: caller } = await admin.from("users").select("role, status").eq("id", u.user.id).maybeSingle();
  if (!caller || caller.role !== "admin" || caller.status !== "active") return json({ error: "Admins only" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const configured = Boolean(CLIENT_ID && CLIENT_SECRET);

  try {
    if (body.action === "status") {
      const { data: conn } = await admin.from("qbo_connections")
        .select("realm_id, company_name, environment, refresh_expires_at, updated_at").limit(1).maybeSingle();
      return json({ configured, environment: ENV, redirectUri: REDIRECT_URI, connection: conn ?? null });
    }

    if (body.action === "start") {
      if (!configured) return json({ error: "QuickBooks app keys are not set up yet (QBO_CLIENT_ID and QBO_CLIENT_SECRET)." }, 400);
      if (!isAllowedReturnUrl(body.returnUrl)) return json({ error: "Invalid return address" }, 400);
      const state = crypto.randomUUID() + crypto.randomUUID();
      await admin.from("qbo_oauth_states").insert({
        state, user_id: u.user.id, return_url: body.returnUrl,
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      const url = new URL(AUTH_URL);
      url.searchParams.set("client_id", CLIENT_ID!);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "com.intuit.quickbooks.accounting");
      url.searchParams.set("redirect_uri", REDIRECT_URI);
      url.searchParams.set("state", state);
      return json({ url: url.toString() });
    }

    if (body.action === "test") {
      const docNumber = safeDocNumber(body.docNumber);
      if (!docNumber) return json({ error: "Enter a valid invoice number" }, 400);
      if (!configured) return json({ error: "QuickBooks app keys are not set up yet." }, 400);
      const conn = await freshConnection();
      if (!conn) return json({ error: "QuickBooks is not connected yet. Tap Connect QuickBooks first." }, 400);
      const ci = await qboGet(conn, `/companyinfo/${conn.realm_id}?minorversion=75`);
      const companyName = ci?.CompanyInfo?.CompanyName ?? null;
      const q = encodeURIComponent(`select * from Invoice where DocNumber = '${docNumber}'`);
      const inv = await qboGet(conn, `/query?query=${q}&minorversion=75`);
      return json({ companyName, realmId: conn.realm_id, environment: ENV, invoice: summarizeInvoice(docNumber, inv) });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("qbo-connect error", e);
    return json({ error: (e as Error).message }, 502);
  }
});
