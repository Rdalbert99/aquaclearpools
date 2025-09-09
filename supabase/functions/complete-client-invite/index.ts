import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompleteInviteRequest {
  token: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  password: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as CompleteInviteRequest;
    if (!body.token || !body.password) {
      return new Response(JSON.stringify({ error: "Missing token or password" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Basic password complexity: min 12 chars, at least 3 of 4 categories, no spaces
    const pwd = body.password;
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
    const categories = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    if (pwd.length < 12 || categories < 3 || /\s/.test(pwd)) {
      return new Response(JSON.stringify({ error: "Password does not meet complexity requirements" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Rate limit by IP for public endpoint
    try {
      const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown';
      const { data: allowed, error: rlError } = await admin.rpc('check_rate_limit', {
        p_identifier: ip,
        p_endpoint: 'complete-client-invite',
        p_max_requests: 5,
        p_window_minutes: 15,
      });
      if (rlError) console.warn('check_rate_limit error:', rlError);
      if (allowed === false) {
        return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    } catch (e) {
      console.warn('Rate limit RPC failed (continuing):', e);
    }

    // Validate invite
    const { data: invite, error: invErr } = await admin
      .from("client_invitations")
      .select("*, clients:client_id(id, customer, user_id)")
      .eq("token", body.token)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (invErr || !invite) {
      return new Response(JSON.stringify({ error: "Invalid or expired invitation" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const email = body.email || invite.email;
    if (!email) {
      return new Response(JSON.stringify({ error: "An email address is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Try to find existing auth user by email
    const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) throw listErr;
    const existing = usersPage.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    let authUserId = existing?.id;

    if (!authUserId) {
      // Create auth user
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
      });
      if (createErr || !created.user) throw createErr || new Error("Failed to create auth user");
      authUserId = created.user.id;
    }

    // Upsert into public.users profile with email as the login/username
    const normalizedEmail = email.toLowerCase().trim();
    const login = normalizedEmail; // Enforce email as unique username
    const name = body.name || invite.clients.customer || normalizedEmail.split("@")[0];

    const { error: upsertErr } = await admin
      .from("users")
      .upsert({
        id: authUserId,
        email: normalizedEmail,
        role: "client",
        name,
        login,
        address: body.address || null,
        phone: body.phone || invite.phone || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
    if (upsertErr) throw upsertErr;

    // Link client to this user
    const { error: linkErr } = await admin
      .from("clients")
      .update({ user_id: authUserId, updated_at: new Date().toISOString() })
      .eq("id", invite.client_id);
    if (linkErr) throw linkErr;

    // Mark invite used
    const { error: usedErr } = await admin
      .from("client_invitations")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);
    if (usedErr) throw usedErr;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("complete-client-invite error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unexpected error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
