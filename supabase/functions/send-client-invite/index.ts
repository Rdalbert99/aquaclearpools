import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
// Switched to Mailjet for email delivery

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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MJ_API_URL = "https://api.mailjet.com/v3.1/send";
function encodeBasicAuth(key: string, secret: string) {
  try { return btoa(`${key}:${secret}`); } catch {
    // @ts-ignore
    return Buffer.from(`${key}:${secret}`).toString("base64");
  }
}
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

    // Skipping client lookup to avoid schema dependency; greeting will be generic.

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

    // Send Email via Mailjet if requested
    let emailStatus: any = null;
    if (body.channels.includes("email")) {
      if (!body.email) {
        throw new Error("Email channel selected but no email provided");
      }
      const html = `
        <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
          <h2>Complete Your Aqua Clear Account</h2>
          <p>Hello!</p>
          <p>An administrator invited you to create your client account. Review your details and set a password here:</p>
          <p><a href="${link}" target="_blank" style="display:inline-block;padding:10px 16px;background:#0ea5e9;color:#fff;border-radius:6px;text-decoration:none">Create My Account</a></p>
          <p>If the button doesn't work, copy this link into your browser:</p>
          <p style="word-break:break-all"><a href="${link}">${link}</a></p>
          <p>This link expires in 7 days.</p>
        </div>`;

      const fromEmailRaw = Deno.env.get("RESEND_FROM_EMAIL") || "no-reply@getaquaclear.com";
      const replyToEmail = Deno.env.get("RESEND_REPLY_TO") || undefined;
      const fromSafe = fromEmailRaw.includes("getaquaclear.com") ? fromEmailRaw : "no-reply@getaquaclear.com";
      const defaultFromEmail = fromSafe;
      const defaultFromName = "AquaClear Pools";

      const apiKey = Deno.env.get("MAILJET_API_KEY");
      const apiSecret = Deno.env.get("MAILJET_API_SECRET");
      if (!apiKey || !apiSecret) {
        throw new Error("Missing MAILJET_API_KEY/MAILJET_API_SECRET");
      }

      const payload = {
        Messages: [
          {
            From: { Email: defaultFromEmail, Name: defaultFromName },
            To: [{ Email: body.email }],
            Subject: "Create your Aqua Clear client account",
            TextPart: `You've been invited to create your Aqua Clear client account. Use this link: ${link}`,
            HTMLPart: html,
            ...(replyToEmail ? { ReplyTo: replyToEmail } : {}),
            Headers: { "List-Unsubscribe": replyToEmail ? `<mailto:${replyToEmail}>` : `<mailto:support@getaquaclear.com>` }
          }
        ]
      };

      const auth = encodeBasicAuth(apiKey, apiSecret);
      const mjRes = await fetch(MJ_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const mjJson = await mjRes.json();
      if (!mjRes.ok) {
        console.error("Mailjet API error:", mjJson);
        throw new Error("Mailjet send failed");
      }
      emailStatus = mjJson;
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
