import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendTechInviteRequest {
  email?: string;
  phone?: string;
  channels: ("email" | "sms")[];
  baseUrl: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MJ_API_URL = "https://api.mailjet.com/v3.1/send";

function encodeBasicAuth(key: string, secret: string) {
  try { return btoa(`${key}:${secret}`); } catch {
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

    // Verify admin role
    const { data: userData } = await userClient.auth.getUser();
    const { data: roleData } = await userClient.rpc("get_current_user_role");

    if (!userData?.user || roleData !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = (await req.json()) as SendTechInviteRequest;
    if (!body.baseUrl || !body.channels?.length) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (body.channels.includes("email") && !body.email) {
      return new Response(JSON.stringify({ error: "Email channel selected but no email provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (body.channels.includes("sms") && !body.phone) {
      return new Response(JSON.stringify({ error: "SMS channel selected but no phone provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Generate token and create invitation
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await adminClient
      .from("tech_invitations")
      .insert({
        token,
        email: body.email || null,
        phone: body.phone || null,
        expires_at: expiresAt,
        invited_by: userData.user.id,
      });

    if (insertError) throw insertError;

    const link = `${body.baseUrl.replace(/\/$/, "")}/auth/tech-invite/${token}`;

    // Send Email via Mailjet
    if (body.channels.includes("email")) {
      const html = `
        <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
          <h2>Join Aqua Clear as a Technician</h2>
          <p>Hello!</p>
          <p>You've been invited to join the Aqua Clear team as a pool service technician. Click the button below to create your account:</p>
          <p><a href="${link}" target="_blank" style="display:inline-block;padding:10px 16px;background:#0ea5e9;color:#fff;border-radius:6px;text-decoration:none">Create My Tech Account</a></p>
          <p>If the button doesn't work, copy this link into your browser:</p>
          <p style="word-break:break-all"><a href="${link}">${link}</a></p>
          <p>This link expires in 7 days.</p>
        </div>`;

      const apiKey = Deno.env.get("MAILJET_API_KEY");
      const apiSecret = Deno.env.get("MAILJET_API_SECRET");
      if (!apiKey || !apiSecret) throw new Error("Missing MAILJET_API_KEY/MAILJET_API_SECRET");

      const replyToEmail = Deno.env.get("RESEND_REPLY_TO") || undefined;
      const payload = {
        Messages: [{
          From: { Email: "randy@getaquaclear.com", Name: "AquaClear Pools" },
          To: [{ Email: body.email }],
          Subject: "You're invited to join Aqua Clear as a Technician",
          TextPart: `You've been invited to join Aqua Clear as a technician. Create your account here: ${link}`,
          HTMLPart: html,
          ...(replyToEmail ? { ReplyTo: { Email: replyToEmail, Name: "AquaClear Pools" } } : {}),
        }],
      };

      const auth = encodeBasicAuth(apiKey, apiSecret);
      const mjRes = await fetch(MJ_API_URL, {
        method: "POST",
        headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!mjRes.ok) {
        const mjJson = await mjRes.json();
        console.error("Mailjet API error:", mjJson);
        throw new Error("Mailjet send failed");
      }
    }

    // Send SMS via Telnyx
    if (body.channels.includes("sms")) {
      const apiKey = Deno.env.get("TELNYX_API_KEY");
      if (!apiKey) {
        console.warn("TELNYX_API_KEY missing; skipping SMS");
      } else {
        let cleanedPhone = body.phone!.replace(/\D/g, "");
        if (cleanedPhone.length === 10) cleanedPhone = "1" + cleanedPhone;
        if (!cleanedPhone.startsWith("+")) cleanedPhone = "+" + cleanedPhone;

        const smsRes = await fetch("https://api.telnyx.com/v2/messages", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "+16014198527",
            to: cleanedPhone,
            text: `Aqua Clear: You've been invited to join as a technician. Create your account: ${link}`,
          }),
        });

        if (!smsRes.ok) {
          const smsData = await smsRes.json();
          console.error("Telnyx SMS error:", smsData);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("send-tech-invite error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unexpected error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
