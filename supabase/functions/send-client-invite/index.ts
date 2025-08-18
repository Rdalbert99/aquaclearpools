import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendInviteRequest {
  clientId: string;
  email?: string;
  phone?: string;
  channels: ("email" | "sms")[];
  baseUrl: string; // e.g. https://your-app.com
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userData } = await userClient.auth.getUser();
    const { data: roleData } = await userClient.rpc("get_current_user_role");

    if (!userData?.user || roleData !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = (await req.json()) as SendInviteRequest;
    if (!body.clientId || !body.baseUrl || !body.channels?.length) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch client for context (e.g., name)
    const { data: client, error: clientError } = await adminClient
      .from("clients")
      .select("id, customer, phone")
      .eq("id", body.clientId)
      .maybeSingle();

    if (clientError || !client) {
      throw clientError || new Error("Client not found");
    }

    // Generate a token and create invitation
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error: inviteError } = await adminClient
      .from("client_invitations")
      .insert({
        client_id: body.clientId,
        token,
        email: body.email || null,
        phone: body.phone || null,
        expires_at: expiresAt,
        created_by: userData.user.id,
      })
      .select()
      .single();

    if (inviteError) throw inviteError;

    const link = `${body.baseUrl.replace(/\/$/, "")}/auth/invite/${token}`;

    // Send Email via Resend if requested
    let emailStatus: any = null;
    if (body.channels.includes("email")) {
      if (!body.email) {
        throw new Error("Email channel selected but no email provided");
      }
      const html = `
        <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
          <h2>Complete Your Aqua Clear Account</h2>
          <p>Hello${client.customer ? `, ${client.customer}` : ""}!</p>
          <p>An administrator invited you to create your client account. Review your details and set a password here:</p>
          <p><a href="${link}" target="_blank" style="display:inline-block;padding:10px 16px;background:#0ea5e9;color:#fff;border-radius:6px;text-decoration:none">Create My Account</a></p>
          <p>If the button doesn't work, copy this link into your browser:</p>
          <p style="word-break:break-all"><a href="${link}">${link}</a></p>
          <p>This link expires in 7 days.</p>
        </div>`;

      const sent = await resend.emails.send({
        from: "Aqua Clear <onboarding@resend.dev>",
        to: [body.email],
        subject: "Create your Aqua Clear client account",
        html,
      });
      emailStatus = sent;
    }

    // Send SMS via Twilio if requested (optional if secrets provided)
    let smsStatus: any = null;
    if (body.channels.includes("sms")) {
      const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const auth = Deno.env.get("TWILIO_AUTH_TOKEN");
      const from = Deno.env.get("TWILIO_FROM_NUMBER");
      if (!sid || !auth || !from) {
        console.warn("Twilio secrets missing; skipping SMS");
      } else {
        const twilio = await import("npm:twilio@4.21.0");
        const clientTwilio = twilio.default(sid, auth);
        if (!body.phone) throw new Error("SMS channel selected but no phone provided");
        smsStatus = await clientTwilio.messages.create({
          body: `Aqua Clear: Finish creating your account: ${link}`,
          to: body.phone,
          from,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("send-client-invite error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unexpected error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
