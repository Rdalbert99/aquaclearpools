import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { decideLink, normalizeEmail } from "../_shared/customer-link.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return json({ error: "Unauthorized" }, 401);

    const email = normalizeEmail(user.email);
    const { data: profile } = await admin.from("users").select("role").eq("id", user.id).maybeSingle();
    const { data: mine } = await admin.from("clients").select("id").eq("user_id", user.id);
    // Exact normalized match on the verified auth email only.
    const { data: cands, error: cErr } = email
      ? await admin.from("clients").select("id, user_id").ilike("contact_email", email.replace(/[\\%_]/g, "\\$&"))
      : { data: [], error: null };
    if (cErr) throw cErr;

    const decision = decideLink({
      email,
      emailConfirmedAt: user.email_confirmed_at,
      profileRole: profile?.role,
      alreadyLinkedClientIds: (mine ?? []).map((r) => r.id),
      candidates: (cands ?? []).filter((c: any) => c.user_id !== user.id),
    });

    let status = decision.status;
    if (status === "linked" && decision.clientId) {
      // Race-safe: only claims a record that is still unowned.
      const { data: claimed, error: uErr } = await admin.from("clients")
        .update({ user_id: user.id, updated_at: new Date().toISOString() })
        .eq("id", decision.clientId).is("user_id", null).select("id");
      if (uErr) throw uErr;
      if (!claimed?.length) status = "needs_review";
      else {
        await admin.from("client_invitations").update({ used_at: new Date().toISOString() })
          .eq("client_id", decision.clientId).is("used_at", null);
      }
    }
    if (status === "linked" || status === "needs_review") {
      await admin.from("security_events").insert({
        event_type: status === "linked" ? "customer_self_link" : "customer_link_needs_review",
        user_id: user.id,
        severity: status === "linked" ? "info" : "warning",
        endpoint: "link-existing-customer",
        payload: { client_id: status === "linked" ? decision.clientId : null, candidates: (cands ?? []).length },
      });
    }
    // Only the caller's own status is returned; no customer data is exposed.
    return json({ status });
  } catch (e) {
    console.error("link-existing-customer error:", (e as Error)?.message);
    return json({ error: "Could not check your customer record right now." }, 500);
  }
});
