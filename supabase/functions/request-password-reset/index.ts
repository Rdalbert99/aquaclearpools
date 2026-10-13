// Public "Forgot password" endpoint.
// Accepts a username OR the email on file, creates a one-time recovery token and
// emails it (via Resend) to the account's real contact email — never to the hidden
// sign-in address, which may be a synthetic @accounts.getaquaclear.com identity.
// Responses only ever include a masked email hint; errors are logged server-side.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ORIGINS = [
  "https://getaquaclear.com",
  "https://www.getaquaclear.com",
  "https://aquaclear-pools.lovable.app",
  "https://id-preview--413f3da6-68de-43ec-849a-5c8f25cadb71.lovable.app",
  "http://localhost:8080",
];
const SYNTHETIC_DOMAIN = "@accounts.getaquaclear.com";
const WINDOW_MIN = 15;
const MAX_ATTEMPTS = 5;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function isRealEmail(e: string | null | undefined): e is string {
  return !!e && /^[^\s@*]+@[^\s@*]+\.[^\s@*]+$/.test(e) && !e.toLowerCase().endsWith(SYNTHETIC_DOMAIN);
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let identifier = "";
  let origin = "https://getaquaclear.com";
  try {
    const body = await req.json();
    identifier = String(body?.identifier ?? "").trim();
    if (typeof body?.origin === "string" && ALLOWED_ORIGINS.includes(body.origin)) origin = body.origin;
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (!identifier || identifier.length > 254) return json({ error: "Enter your username or email." }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // Rate limit by identifier and by caller IP.
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const idHash = await sha256(identifier.toLowerCase());
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  const [{ count: byId }, { count: byIp }] = await Promise.all([
    admin.from("password_reset_attempts").select("*", { count: "exact", head: true }).eq("identifier_hash", idHash).gte("created_at", since),
    admin.from("password_reset_attempts").select("*", { count: "exact", head: true }).eq("ip", ip).gte("created_at", since),
  ]);
  await admin.from("password_reset_attempts").insert({
    identifier_hash: idHash, ip, user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? "unknown",
  });
  if ((byId ?? 0) >= MAX_ATTEMPTS || (byIp ?? 0) >= MAX_ATTEMPTS * 2) {
    return json({ error: `Too many attempts. Please wait ${WINDOW_MIN} minutes and try again.` }, 429);
  }

  // Find matching accounts by username, contact email, or sign-in email.
  const lower = identifier.toLowerCase();
  const { data: accounts, error: lookupError } = await admin
    .from("users")
    .select("id, login, email, auth_email, first_name, status")
    .or(`login.ilike.${lower.replace(/[,()%*]/g, "")},email.ilike.${lower.replace(/[,()%*]/g, "")},auth_email.ilike.${lower.replace(/[,()%*]/g, "")}`)
    .limit(5);
  if (lookupError) {
    console.error("Account lookup failed:", lookupError.message);
    return json({ error: "We couldn't process that right now. Please try again." }, 500);
  }

  const matches = (accounts ?? []).filter((a) =>
    [a.login, a.email, a.auth_email].some((v) => (v ?? "").toLowerCase() === lower)
  );
  if (matches.length === 0) {
    console.log("Password reset: no matching account");
    return json({ found: false });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("RESEND_API_KEY is not configured");
    return json({ error: "Email service is not configured. Please contact Aqua Clear Pools." }, 500);
  }

  const hints = new Set<string>();
  let sent = 0;
  let noEmail = 0;
  for (const acct of matches) {
    const signInEmail = acct.auth_email || acct.email;
    const deliverTo = isRealEmail(acct.email) ? acct.email : isRealEmail(acct.auth_email) ? acct.auth_email : null;
    if (!signInEmail || !deliverTo) { noEmail++; continue; }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: signInEmail,
    });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      console.error("generateLink failed for account", acct.id, linkError?.message);
      continue;
    }
    const link = `${origin}/auth/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
    const name = escapeHtml(acct.first_name || "there");
    const username = escapeHtml(acct.login || "");

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
        <div style="background:#0050A4;color:#ffffff;padding:24px;text-align:center;border-radius:8px 8px 0 0">
          <h1 style="margin:0;font-size:22px">Aqua Clear Pools</h1>
        </div>
        <div style="padding:24px;background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <p>Hi ${name},</p>
          <p>We received a request to reset the password for your Aqua Clear Pools account${username ? ` (username <strong>${username}</strong>)` : ""}.</p>
          <p style="text-align:center;margin:28px 0">
            <a href="${link}" style="background:#0050A4;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Reset My Password</a>
          </p>
          <p style="font-size:13px;color:#6b7280">This link works once and expires in 1 hour. If you didn't ask for this, you can ignore this email — your password won't change.</p>
          <p style="font-size:13px;color:#6b7280">If the button doesn't work, copy this link into your browser:<br><a href="${link}" style="color:#0050A4;word-break:break-all">${link}</a></p>
          <p style="margin-top:24px">Aqua Clear Pools<br>(601) 447-0399 · randy@getaquaclear.com</p>
        </div>
      </div>`;
    const text = `Hi ${acct.first_name || "there"},\n\nWe received a request to reset the password for your Aqua Clear Pools account${acct.login ? ` (username ${acct.login})` : ""}.\n\nReset your password here (works once, expires in 1 hour):\n${link}\n\nIf you didn't ask for this, ignore this email.\n\nAqua Clear Pools\n(601) 447-0399`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Aqua Clear Pools <randy@getaquaclear.com>",
        to: [deliverTo],
        reply_to: "randy@getaquaclear.com",
        subject: "Reset your Aqua Clear Pools password",
        html,
        text,
      }),
    });
    if (!res.ok) {
      console.error(`Resend error [${res.status}] for account ${acct.id}: ${await res.text()}`);
      continue;
    }
    sent++;
    hints.add(maskEmail(deliverTo));
  }

  if (sent === 0) {
    if (noEmail > 0) return json({ found: true, sent: false, reason: "no_email" });
    return json({ error: "We found your account but couldn't send the email. Please try again or call (601) 447-0399." }, 502);
  }
  console.log(`Password reset email sent for ${sent} account(s)`);
  return json({ found: true, sent: true, hints: [...hints] });
});
