import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompleteTechInviteRequest {
  token: string;
  firstName: string;
  lastName: string;
  login: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as CompleteTechInviteRequest;
    if (!body.token || !body.password || !body.firstName || !body.lastName || !body.login || !body.email) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Password complexity: min 12 chars, at least 3 of 4 categories, no spaces
    const pwd = body.password;
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
    const categories = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    if (pwd.length < 12 || categories < 3 || /\s/.test(pwd)) {
      return new Response(JSON.stringify({ error: "Password must be at least 12 characters with uppercase, lowercase, and numbers" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Rate limit
    try {
      const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown';
      const { data: allowed } = await admin.rpc('check_rate_limit', {
        p_identifier: ip,
        p_endpoint: 'complete-tech-invite',
        p_max_requests: 5,
        p_window_minutes: 15,
      });
      if (allowed === false) {
        return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    } catch (e) {
      console.warn('Rate limit check failed (continuing):', e);
    }

    // Validate token
    const { data: tokenResult, error: tokenError } = await admin.rpc('validate_tech_invitation_token', { token_input: body.token });
    
    if (tokenError || !tokenResult || tokenResult.error) {
      return new Response(JSON.stringify({ error: tokenResult?.error || "Invalid or expired invitation" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check login uniqueness
    const { data: existingLogin } = await admin
      .from("users")
      .select("id")
      .ilike("login", body.login)
      .limit(1)
      .single();

    if (existingLogin) {
      return new Response(JSON.stringify({ error: "Username is already taken" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Create auth user
    const normalizedEmail = body.email.toLowerCase().trim();
    
    // Check if auth user exists
    const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = usersPage?.users.find((u) => u.email?.toLowerCase() === normalizedEmail);

    let authUserId = existing?.id;
    if (!authUserId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password: body.password,
        email_confirm: true,
      });
      if (createErr || !created.user) throw createErr || new Error("Failed to create auth user");
      authUserId = created.user.id;
    }

    // Create user profile as tech
    const { error: upsertErr } = await admin
      .from("users")
      .upsert({
        id: authUserId,
        email: normalizedEmail,
        login: body.login.trim(),
        name: `${body.firstName.trim()} ${body.lastName.trim()}`,
        first_name: body.firstName.trim(),
        last_name: body.lastName.trim(),
        role: "tech",
        phone: body.phone || null,
        address: body.address || null,
        status: "active",
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    if (upsertErr) throw upsertErr;

    // Mark invitation as used
    const { error: usedErr } = await admin
      .from("tech_invitations")
      .update({ used_at: new Date().toISOString() })
      .eq("token", body.token)
      .is("used_at", null);

    if (usedErr) console.warn("Failed to mark invite as used:", usedErr);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("complete-tech-invite error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unexpected error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
