// Read-only QuickBooks Online connection for Aqua Clear admins.
// Actions (POST, admin JWT): status | start | test | disconnect | logs.  GET = Intuit OAuth callback.
// Never creates or changes anything in QuickBooks. All Intuit calls go through _shared/qbo-oauth.ts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { isAllowedReturnUrl, safeDocNumber, summarizeInvoice } from "../_shared/qbo-summary.ts";
import {
  DISCOVERY_URLS, FALLBACK_ENDPOINTS, OAuthEndpoints, QboError, accessNeedsRefresh, expectJson,
  friendlyMessage, needsReconnect, parseDiscovery, refreshExpired, requestWithRetry, safeJson, sanitize,
} from "../_shared/qbo-oauth.ts";

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
const API_BASE = ENV === "sandbox" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com";

const admin = createClient(SUPABASE_URL, SERVICE);

// ---- Discovery (cached 24h; falls back to last good copy, then known defaults)
let discovery: { at: number; endpoints: OAuthEndpoints } | null = null;
async function endpoints(): Promise<OAuthEndpoints> {
  if (discovery && Date.now() - discovery.at < 86_400_000) return discovery.endpoints;
  try {
    const r = await requestWithRetry(fetch, DISCOVERY_URLS[ENV], { headers: { Accept: "application/json" } }, { retry: true });
    const parsed = r.status === 200 ? parseDiscovery(safeJson(r.text).ok ? JSON.parse(r.text) : null) : null;
    if (parsed) { discovery = { at: Date.now(), endpoints: parsed }; return parsed; }
    console.error("QBO discovery unusable", r.status);
  } catch (e) { console.error("QBO discovery failed", sanitize((e as Error).message)); }
  return discovery?.endpoints ?? FALLBACK_ENDPOINTS;
}

// ---- Sanitized persistent error log (admin-readable, no tokens or personal details)
async function logError(action: string, e: QboError, userId: string | null, endpoint?: string) {
  console.error(`qbo ${action} ${e.kind} status=${e.status} tid=${e.intuitTid} ${sanitize(e.message)}`);
  try {
    await admin.from("qbo_error_logs").insert({
      action, endpoint: endpoint ? endpoint.split("?")[0].replace(/\/company\/\d+/, "/company/{realm}") : null,
      http_status: e.status, error_code: e.code ?? e.kind, message: sanitize(e.message),
      intuit_tid: e.intuitTid, attempts: e.attempts, user_id: userId,
    });
  } catch (err) { console.error("qbo error log write failed", err); }
}

const basicAuth = () => "Basic " + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);

async function tokenRequest(params: Record<string, string>, retry: boolean) {
  const ep = await endpoints();
  const r = await requestWithRetry(fetch, ep.token_endpoint, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(params),
  }, { retry });
  return expectJson(r);
}

const expiry = (secs: number | undefined) => (secs ? new Date(Date.now() + secs * 1000).toISOString() : null);

async function markNeedsReconnect(id: string) {
  await admin.from("qbo_connections").update({ needs_reconnect: true }).eq("id", id);
}

async function refresh(conn: any) {
  if (refreshExpired(conn.refresh_expires_at)) {
    await markNeedsReconnect(conn.id);
    throw new QboError("invalid_grant", "Saved QuickBooks refresh token has expired.");
  }
  try {
    // Refresh is idempotent on Intuit's side, so transient retries are safe.
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: conn.refresh_token }, true);
    const upd = {
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? conn.refresh_token,
      access_expires_at: expiry(t.expires_in)!,
      refresh_expires_at: expiry(t.x_refresh_token_expires_in) ?? conn.refresh_expires_at,
      needs_reconnect: false,
    };
    await admin.from("qbo_connections").update(upd).eq("id", conn.id);
    return { ...conn, ...upd };
  } catch (e) {
    if (e instanceof QboError && e.kind === "invalid_grant") await markNeedsReconnect(conn.id);
    throw e;
  }
}

async function connection() {
  const { data: conn } = await admin.from("qbo_connections").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!conn) throw new QboError("not_connected", "QuickBooks is not connected yet.");
  if (conn.needs_reconnect) throw new QboError("not_connected", "QuickBooks needs to be reconnected.");
  return accessNeedsRefresh(conn.access_expires_at) ? refresh(conn) : conn;
}

/** Read-only GET. On 401 refreshes the token once and retries once. */
async function qboGet(conn: any, path: string): Promise<{ conn: any; data: any }> {
  const go = (c: any) => requestWithRetry(fetch, `${API_BASE}/v3/company/${c.realm_id}${path}`, {
    headers: { Authorization: `Bearer ${c.access_token}`, Accept: "application/json" },
  }, { retry: true });
  let r = await go(conn);
  if (r.status === 401) { conn = await refresh(conn); r = await go(conn); }
  return { conn, data: expectJson(r) };
}

async function revoke(token: string) {
  const ep = await endpoints();
  const r = await requestWithRetry(fetch, ep.revocation_endpoint, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ token }),
  }, { retry: true });
  if (r.status !== 200) throw new QboError(r.status >= 500 ? "server" : "bad_request", sanitize(r.text || `HTTP ${r.status}`), r.status, null, r.intuitTid, r.attempts);
}

function redirect(url: string, params: Record<string, string>) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: u.toString() } });
}

async function handleCallback(req: Request) {
  const q = new URL(req.url).searchParams;
  const state = q.get("state") ?? "";
  // CSRF: state must exist, be unused and unexpired; it is consumed immediately.
  const { data: st } = state ? await admin.from("qbo_oauth_states").select("*").eq("state", state).maybeSingle() : { data: null };
  if (!st || st.used_at || new Date(st.expires_at) < new Date()) {
    await logError("callback", new QboError("bad_request", "OAuth state missing, unknown, used or expired"), null);
    return new Response("This QuickBooks sign-in link expired or is invalid. Go back to Aqua Clear and start again.", { status: 400 });
  }
  await admin.from("qbo_oauth_states").update({ used_at: new Date().toISOString() }).eq("state", state);
  const back = st.return_url;
  if (q.get("error")) return redirect(back, { qbo: "error", reason: sanitize(q.get("error"), 60) });
  const code = q.get("code"), realmId = q.get("realmId");
  if (!code || !realmId || !/^\d+$/.test(realmId)) return redirect(back, { qbo: "error", reason: "missing_code" });
  try {
    // One-time code: never retried.
    const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI }, false);
    const row: any = {
      realm_id: realmId, environment: ENV,
      access_token: t.access_token, refresh_token: t.refresh_token,
      access_expires_at: expiry(t.expires_in)!, refresh_expires_at: expiry(t.x_refresh_token_expires_in),
      connected_by: st.user_id, needs_reconnect: false,
    };
    let companyName: string | null = null;
    try {
      const { data } = await qboGet(row, `/companyinfo/${realmId}?minorversion=75`);
      companyName = data?.CompanyInfo?.CompanyName ?? null;
    } catch (e) { if (e instanceof QboError) await logError("companyinfo", e, st.user_id); }
    await admin.from("qbo_connections").delete().neq("realm_id", realmId);
    const { error } = await admin.from("qbo_connections").upsert({ ...row, company_name: companyName }, { onConflict: "realm_id" });
    if (error) throw error;
    return redirect(back, { qbo: "connected" });
  } catch (e) {
    const err = e instanceof QboError ? e : new QboError("server", sanitize((e as Error).message));
    await logError("token_exchange", err, st.user_id);
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
  const action = String(body.action ?? "");

  try {
    if (action === "status") {
      const { data: conn } = await admin.from("qbo_connections")
        .select("realm_id, company_name, environment, refresh_expires_at, updated_at, needs_reconnect").limit(1).maybeSingle();
      const expired = conn ? conn.needs_reconnect || refreshExpired(conn.refresh_expires_at) : false;
      return json({ configured, environment: ENV, redirectUri: REDIRECT_URI, connection: conn ?? null, needsReconnect: expired });
    }

    if (action === "logs") {
      const { data } = await admin.from("qbo_error_logs")
        .select("id, created_at, action, endpoint, http_status, error_code, message, intuit_tid, attempts")
        .order("created_at", { ascending: false }).limit(25);
      return json({ logs: data ?? [] });
    }

    if (action === "start") {
      if (!configured) return json({ error: "QuickBooks app keys are not set up yet (QBO_CLIENT_ID and QBO_CLIENT_SECRET)." }, 400);
      if (!isAllowedReturnUrl(body.returnUrl)) return json({ error: "Invalid return address" }, 400);
      const state = crypto.randomUUID() + crypto.randomUUID();
      await admin.from("qbo_oauth_states").insert({
        state, user_id: u.user.id, return_url: body.returnUrl,
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      const url = new URL((await endpoints()).authorization_endpoint);
      url.searchParams.set("client_id", CLIENT_ID!);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "com.intuit.quickbooks.accounting");
      url.searchParams.set("redirect_uri", REDIRECT_URI);
      url.searchParams.set("state", state);
      return json({ url: url.toString() });
    }

    if (action === "disconnect") {
      const { data: conn } = await admin.from("qbo_connections").select("id, refresh_token").limit(1).maybeSingle();
      if (!conn) return json({ disconnected: true, revoked: false });
      let revoked = false;
      if (configured) {
        try { await revoke(conn.refresh_token); revoked = true; }
        catch (e) { if (e instanceof QboError) await logError("revoke", e, u.user.id); }
      }
      await admin.from("qbo_connections").delete().eq("id", conn.id);
      return json({ disconnected: true, revoked });
    }

    if (action === "test") {
      const docNumber = safeDocNumber(body.docNumber);
      if (!docNumber) return json({ error: "Enter a valid invoice number" }, 400);
      if (!configured) return json({ error: "QuickBooks app keys are not set up yet." }, 400);
      let conn = await connection();
      const ci = await qboGet(conn, `/companyinfo/${conn.realm_id}?minorversion=75`);
      conn = ci.conn;
      const q = encodeURIComponent(`select * from Invoice where DocNumber = '${docNumber}'`);
      const inv = await qboGet(conn, `/query?query=${q}&minorversion=75`);
      return json({
        companyName: ci.data?.CompanyInfo?.CompanyName ?? null, realmId: conn.realm_id, environment: ENV,
        invoice: summarizeInvoice(docNumber, inv.data),
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const err = e instanceof QboError ? e : new QboError("server", sanitize((e as Error)?.message ?? "Unknown error"));
    await logError(action || "unknown", err, u.user.id);
    return json({ error: friendlyMessage(err), kind: err.kind, intuitTid: err.intuitTid, needsReconnect: needsReconnect(err) }, err.kind === "not_connected" || err.kind === "invalid_grant" ? 409 : 502);
  }
});
