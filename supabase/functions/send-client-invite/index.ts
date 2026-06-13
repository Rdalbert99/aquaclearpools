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
    if (!body.clientId || !body.channels?.length) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Always use the production custom domain for the invite link,
    // regardless of where the admin sent the request from.
    const PUBLIC_BASE_URL = "https://getaquaclear.com";

    // Look up the client's name so the greeting can be personal.
    let customerName = "";
    try {
      const { data: clientRow } = await adminClient
        .from("clients")
        .select("customer")
        .eq("id", body.clientId)
        .maybeSingle();
      customerName = (clientRow?.customer || "").trim();
    } catch (e) {
      console.warn("client lookup failed (continuing):", e);
    }
    const firstName = customerName.split(/\s+/)[0] || "there";

    // Generate a secure token and create invitation
    const token = crypto.randomUUID();
    const { data: tokenHashData, error: hashErr } = await adminClient.rpc('hash_invitation_token', { token_input: token });
    if (hashErr) {
      console.error('hash_invitation_token error:', hashErr);
      throw new Error(`Failed to hash token: ${hashErr.message}`);
    }
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Normalize phone to E.164 (e.g. +16014105392) to satisfy DB check constraint
    let normalizedPhone: string | null = null;
    if (body.phone) {
      const digits = body.phone.replace(/\D/g, "");
      const withCountry = digits.length === 10 ? "1" + digits : digits;
      normalizedPhone = "+" + withCountry;
    }

    const { data: invite, error: inviteError } = await adminClient
      .from("client_invitations")
      .insert({
        client_id: body.clientId,
        token,
        token_hash: tokenHashData,
        email: body.email || null,
        phone: normalizedPhone,
        expires_at: expiresAt,
        created_by: userData.user.id,
      })
      .select()
      .single();

    if (inviteError) {
      console.error('client_invitations insert error:', inviteError);
      throw new Error(`Failed to create invitation: ${inviteError.message}`);
    }

    const link = `${PUBLIC_BASE_URL}/auth/invite/${token}`;

    // Send Email via Mailjet if requested
    let emailStatus: any = null;
    if (body.channels.includes("email")) {
      if (!body.email) {
        throw new Error("Email channel selected but no email provided");
      }
      const logoUrl = `${PUBLIC_BASE_URL}/aqua-clear-logo-3d.png`;
      const primary = "#0099E5";
      const secondary = "#005B96";
      const html = `
        <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;max-width:600px;margin:0 auto;padding:8px">
          <div style="text-align:center;margin-bottom:20px">
            <img src="${logoUrl}" alt="Aqua Clear Pools" style="max-width:220px;height:auto" />
          </div>
          <h2 style="margin:0 0 16px;color:${primary}">Welcome to Aqua Clear Pools!</h2>
          <p>Thank you for choosing Aqua Clear Pools for your pool care.</p>
          <p>Your customer portal gives you access to:</p>
          <ul style="padding-left:20px;margin:12px 0">
            <li>Service history</li>
            <li>Water test results</li>
            <li>Chemical additions</li>
            <li>Photos from each visit</li>
            <li>Billing and invoices</li>
            <li>Service schedule updates</li>
            <li>Direct communication with our team</li>
          </ul>
          <p>To activate your account, click the button below and create your password.</p>
          <p style="text-align:center;margin:28px 0">
            <a href="${link}" target="_blank" style="display:inline-block;padding:14px 28px;background:${primary};color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">Create My Account</a>
          </p>
          <p style="text-align:center;margin:12px 0">Once your account is active, you can log in anytime to view your pool information and upcoming service visits.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
          <h3 style="margin:0 0 12px;color:${secondary}">What Happens Next?</h3>
          <ol style="padding-left:20px;margin:12px 0">
            <li>Create your password.</li>
            <li>Log into your customer portal.</li>
            <li>Verify your contact information.</li>
            <li>Review your service schedule.</li>
            <li>Receive visit reports after every pool cleaning.</li>
          </ol>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
          <p style="margin:0"><strong>Need help?</strong></p>
          <p style="margin:4px 0">Call or text us at <a href="tel:+16014470399">(601) 447-0399</a></p>
          <p style="margin:4px 0">Email: <a href="mailto:randy@getaquaclear.com">randy@getaquaclear.com</a></p>
          <p style="margin-top:20px;font-style:italic;color:${secondary}">Making Your Pool Aqua Clear</p>
          <p style="margin:4px 0"><strong>Aqua Clear Pools</strong></p>
          <p style="margin:4px 0;color:#6b7280;font-size:13px">Serving Hattiesburg, Sumrall, Petal, Purvis, and surrounding areas.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
          <p style="font-size:12px;color:#9ca3af;text-align:center">This invitation expires in 7 days. If you need a new invitation, contact Aqua Clear Pools.</p>
        </div>`;

      const replyToEmail = Deno.env.get("RESEND_REPLY_TO") || "randy@getaquaclear.com";
      const defaultFromEmail = "randy@getaquaclear.com";
      const defaultFromName = "Aqua Clear Pools";

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
            Bcc: [
              { Email: "randy@getaquaclear.com" },
              { Email: "rdalbert99@gmail.com" },
              { Email: "untoothers@hotmail.com" }
            ],
            Subject: "Welcome to Aqua Clear Pools – Let's Get Your Account Ready",
            TextPart: `Welcome to Aqua Clear Pools!\n\nThank you for choosing Aqua Clear Pools for your pool care.\n\nYour customer portal gives you access to:\n- Service history\n- Water test results\n- Chemical additions\n- Photos from each visit\n- Billing and invoices\n- Service schedule updates\n- Direct communication with our team\n\nTo activate your account, create your password here:\n${link}\n\nOnce your account is active, you can log in anytime to view your pool information and upcoming service visits.\n\nWhat Happens Next?\n1. Create your password.\n2. Log into your customer portal.\n3. Verify your contact information.\n4. Review your service schedule.\n5. Receive visit reports after every pool cleaning.\n\nNeed help?\nCall or text us at (601) 447-0399\nEmail: randy@getaquaclear.com\n\nMaking Your Pool Aqua Clear\nAqua Clear Pools\nServing Hattiesburg, Sumrall, Petal, Purvis, and surrounding areas.\n\nThis invitation expires in 7 days. If you need a new invitation, contact Aqua Clear Pools.`,
            HTMLPart: html,
            ReplyTo: { Email: replyToEmail, Name: defaultFromName },
            Headers: { "List-Unsubscribe": `<mailto:${replyToEmail}>` }
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
        console.error("Mailjet API error:", mjRes.status, JSON.stringify(mjJson));
        throw new Error(`Mailjet send failed (${mjRes.status}): ${JSON.stringify(mjJson)}`);
      }
      emailStatus = mjJson;
    }

    // Send SMS via Telnyx if requested
    let smsStatus: any = null;
    if (body.channels.includes("sms")) {
      const apiKey = Deno.env.get("TELNYX_API_KEY");
      if (!apiKey) {
        console.warn("TELNYX_API_KEY missing; skipping SMS");
      } else {
        if (!body.phone) throw new Error("SMS channel selected but no phone provided");
        
        // Clean and validate phone number
        let cleanedPhone = body.phone.replace(/\D/g, "");
        if (cleanedPhone.length === 10) {
          cleanedPhone = "1" + cleanedPhone; // Add US country code
        }
        if (!cleanedPhone.startsWith("+")) {
          cleanedPhone = "+" + cleanedPhone;
        }

        const smsPayload = {
          from: "+16014198527",
          to: cleanedPhone,
          text: `Aqua Clear: Finish creating your account: ${link}`
        };

        const smsResponse = await fetch("https://api.telnyx.com/v2/messages", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(smsPayload),
        });

        const smsData = await smsResponse.json();
        if (!smsResponse.ok) {
          console.error("Telnyx SMS error:", smsData);
        } else {
          console.log("SMS sent successfully via Telnyx:", smsData);
          smsStatus = smsData;
        }
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
