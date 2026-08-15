import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SignupBody {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  poolType: string;
  poolSize: number | string;
  serviceFrequency?: string;
  serviceNotes?: string;
  password: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SignupBody;

    const required: (keyof SignupBody)[] = [
      "username", "firstName", "lastName", "email", "phone",
      "street", "city", "state", "zipCode", "poolType", "poolSize", "password",
    ];
    for (const key of required) {
      if (!body?.[key] || String(body[key]).trim() === "") {
        return json({ error: `Missing required field: ${key}` }, 400);
      }
    }

    const email = String(body.email).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Please enter a valid email address." }, 400);
    }

    const pwd = body.password;
    if (
      pwd.length < 12 ||
      !/[a-z]/.test(pwd) ||
      !/[A-Z]/.test(pwd) ||
      !/[0-9]/.test(pwd) ||
      /\s/.test(pwd)
    ) {
      return json({
        error: "Password must be at least 12 characters and include uppercase, lowercase, and numbers.",
      }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Rate limit by IP
    try {
      const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "unknown";
      const { data: allowed } = await admin.rpc("check_rate_limit", {
        p_identifier: ip,
        p_endpoint: "public-client-signup",
        p_max_requests: 5,
        p_window_minutes: 60,
      });
      if (allowed === false) {
        return json({ error: "Too many signup attempts. Please try again later." }, 429);
      }
    } catch (e) {
      console.warn("rate limit check failed (continuing):", e);
    }

    const login = String(body.username).toLowerCase().trim();

    // Username availability
    const { data: existingLogin, error: loginErr } = await admin
      .from("users")
      .select("id")
      .ilike("login", login)
      .maybeSingle();
    if (loginErr) throw loginErr;
    if (existingLogin) {
      return json({ error: "That username is already taken. Please choose another." }, 409);
    }

    // Existing auth user?
    const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) throw listErr;
    if (usersPage.users.some((u) => u.email?.toLowerCase() === email)) {
      return json({ error: "An account with this email already exists. Please log in instead." }, 409);
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: pwd,
      email_confirm: true,
    });
    if (createErr || !created.user) throw createErr || new Error("Failed to create account");
    const userId = created.user.id;

    const fullName = `${body.firstName.trim()} ${body.lastName.trim()}`.trim();
    const fullAddress = `${body.street.trim()}, ${body.city.trim()}, ${body.state.trim()} ${body.zipCode.trim()}`;

    const digits = String(body.phone).replace(/\D/g, "");
    const normalizedPhone = digits ? "+" + (digits.length === 10 ? "1" + digits : digits) : null;

    const { error: profileErr } = await admin.from("users").upsert({
      id: userId,
      email,
      // SECURITY: public signup is always a client account.
      role: "client",
      name: fullName,
      login,
      first_name: body.firstName.trim(),
      last_name: body.lastName.trim(),
      phone: normalizedPhone,
      address: fullAddress,
      street_address: body.street.trim(),
      city: body.city.trim(),
      state: body.state.trim(),
      zip_code: body.zipCode.trim(),
      must_change_password: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    if (profileErr) {
      console.error("profile upsert failed:", profileErr);
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      throw new Error("Could not set up your profile. Please contact support.");
    }

    const poolSize = parseInt(String(body.poolSize).replace(/[^\d]/g, ""), 10) || 0;

    const { error: clientErr } = await admin.from("clients").insert({
      user_id: userId,
      customer: fullName,
      pool_size: poolSize,
      pool_type: body.poolType,
      service_frequency: body.serviceFrequency || "weekly",
      service_notes: body.serviceNotes || null,
      status: "Active",
      join_date: new Date().toISOString(),
      contact_email: email,
      contact_phone: normalizedPhone,
      contact_address: fullAddress,
    });

    if (clientErr) {
      console.error("client insert failed:", clientErr);
      return json({
        error: "Your login was created, but we could not finish your pool profile. Please contact Aqua Clear Pools.",
      }, 500);
    }

    return json({ success: true });
  } catch (error: any) {
    console.error("public-client-signup error:", error);
    return json({ error: error?.message || "Unexpected error" }, 500);
  }
});
