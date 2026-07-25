import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
// Using Mailjet API v3.1 for email delivery
const MJ_API_URL = "https://api.mailjet.com/v3.1/send";
function encodeBasicAuth(key: string, secret: string) {
  try { return btoa(`${key}:${secret}`); } catch {
    // @ts-ignore
    return Buffer.from(`${key}:${secret}`).toString("base64");
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const clean = (value: unknown, max: number): string =>
  String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

const ALLOWED_URGENCY = new Set(["low", "normal", "medium", "high", "emergency"]);

interface ServiceRequestData {
  customerData: {
    name: string;
    email: string;
    phone: string;
    address: string;
    poolType: string;
    poolSize: string;
    serviceType: string;
    description: string;
    preferredDate?: string;
    urgency: string;
  };
  requestDetails: {
    type: string;
    urgency: string;
    preferredDate?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== "object" || !raw.customerData) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const rawCustomer = raw.customerData ?? {};
    const rawDetails = raw.requestDetails ?? {};

    const email = clean(rawCustomer.email, 254).toLowerCase();
    const name = clean(rawCustomer.name, 100);
    const description = clean(rawCustomer.description, 2000);
    const urgencyInput = clean(rawDetails.urgency ?? rawCustomer.urgency, 20).toLowerCase();

    if (!EMAIL_RE.test(email) || name.length < 2 || description.length < 3) {
      return new Response(
        JSON.stringify({ error: "A valid name, email address and description are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const customerData = {
      name,
      email,
      phone: clean(rawCustomer.phone, 30),
      address: clean(rawCustomer.address, 200),
      poolType: clean(rawCustomer.poolType, 50),
      poolSize: clean(rawCustomer.poolSize, 50),
      serviceType: clean(rawCustomer.serviceType, 80) || "Service request",
      description,
      preferredDate: clean(rawCustomer.preferredDate, 40),
    };
    const requestDetails = {
      urgency: ALLOWED_URGENCY.has(urgencyInput) ? urgencyInput : "normal",
    };

    // Rate limit this public endpoint per caller IP and per submitted email
    try {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const ip =
        req.headers.get("x-real-ip") ||
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown";

      for (const identifier of [`ip:${ip}`, `email:${email}`]) {
        const { data: allowed } = await admin.rpc("check_rate_limit", {
          p_identifier: identifier,
          p_endpoint: "send-service-request-email",
          p_max_requests: 5,
          p_window_minutes: 60,
        });
        if (allowed === false) {
          return new Response(
            JSON.stringify({ error: "Too many requests. Please try again later." }),
            { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } },
          );
        }
      }
    } catch (rlError) {
      console.error("Rate limit check failed", rlError);
    }

    const replyToEmail = Deno.env.get("RESEND_REPLY_TO") || undefined;
    const defaultFromEmail = "randy@getaquaclear.com";
    const defaultFromName = "AquaClear Pools";
    // Send emails via Mailjet (business + customer)
    const apiKey = Deno.env.get("MAILJET_API_KEY");
    const apiSecret = Deno.env.get("MAILJET_API_SECRET");
    if (!apiKey || !apiSecret) {
      throw new Error("Missing MAILJET_API_KEY/MAILJET_API_SECRET");
    }

    const businessTo = Deno.env.get("AQUACLEAR_BUSINESS_EMAIL") || "randy@getaquaclear.com";

    const payload = {
      Messages: [
        {
          From: { Email: defaultFromEmail, Name: defaultFromName },
          To: [{ Email: businessTo }],
          Bcc: [
            { Email: "randy@getaquaclear.com" },
            { Email: "rdalbert99@gmail.com" },
            { Email: "untoothers@hotmail.com" }
          ],
          Subject: `New Service Request - ${escapeHtml(customerData.serviceType)} (${requestDetails.urgency} priority)`,
          TextPart: `New ${escapeHtml(customerData.serviceType)} request (${requestDetails.urgency}) from ${escapeHtml(customerData.name)}, ${escapeHtml(customerData.email)}, ${escapeHtml(customerData.phone)}.`,
          HTMLPart: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #3b82f6; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">New Service Request</h1>
            <p style="margin: 5px 0;">Aqua Clear Pools</p>
          </div>
          <div style="padding: 20px; background: #f9fafb;">
            <h2 style="color: #1f2937;">Customer Information</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; font-weight: bold;">Name:</td><td style="padding: 8px;">${escapeHtml(customerData.name)}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${escapeHtml(customerData.email)}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Phone:</td><td style="padding: 8px;">${escapeHtml(customerData.phone)}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Address:</td><td style="padding: 8px;">${escapeHtml(customerData.address)}</td></tr>
            </table>
            <h2 style="color: #1f2937; margin-top: 30px;">Pool Information</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; font-weight: bold;">Pool Type:</td><td style="padding: 8px;">${escapeHtml(customerData.poolType)}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Pool Size:</td><td style="padding: 8px;">${escapeHtml(customerData.poolSize)}</td></tr>
            </table>
            <h2 style="color: #1f2937; margin-top: 30px;">Service Request</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; font-weight: bold;">Service Type:</td><td style="padding: 8px;">${escapeHtml(customerData.serviceType)}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Urgency:</td><td style="padding: 8px; color: ${requestDetails.urgency === 'emergency' ? '#dc2626' : requestDetails.urgency === 'high' ? '#ea580c' : '#059669'};">${escapeHtml(requestDetails.urgency.toUpperCase())}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Preferred Date:</td><td style="padding: 8px;">${escapeHtml(customerData.preferredDate || 'Not specified')}</td></tr>
            </table>
            <h2 style="color: #1f2937; margin-top: 30px;">Description</h2>
            <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #3b82f6;">
              ${escapeHtml(customerData.description)}
            </div>
            <div style="margin-top: 30px; padding: 15px; background: #e0f2fe; border-radius: 5px;">
              <p style="margin: 0; color: #0c4a6e;"><strong>Next Steps:</strong></p>
              <ul style="color: #0c4a6e; margin: 10px 0;">
                <li>Contact customer within 24 hours</li>
                <li>Schedule site visit if needed</li>
                <li>Provide quote and service timeline</li>
              </ul>
            </div>
          </div>
        </div>`,
          ...(replyToEmail ? { ReplyTo: { Email: replyToEmail, Name: defaultFromName } } : {}),
          Headers: { "List-Unsubscribe": replyToEmail ? `<mailto:${replyToEmail}>` : `<mailto:support@getaquaclear.com>` }
        },
        {
          From: { Email: defaultFromEmail, Name: defaultFromName },
          To: [{ Email: customerData.email }],
          Bcc: [
            { Email: "randy@getaquaclear.com" },
            { Email: "rdalbert99@gmail.com" },
            { Email: "untoothers@hotmail.com" }
          ],
          Subject: "Service Request Received - Aqua Clear Pools",
          TextPart: `Thank you ${escapeHtml(customerData.name)}. We've received your ${escapeHtml(customerData.serviceType)} request (${requestDetails.urgency}).`,
          HTMLPart: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
          <div style="background: #3b82f6; color: white; padding: 24px; text-align: center;">
            <h1 style="margin: 0;">Thanks, ${escapeHtml(customerData.name)}! We received your request</h1>
            <p style="margin: 8px 0 0 0;">Aqua Clear Pools</p>
          </div>
          <div style="padding: 20px; background: #ffffff;">
            <p style="color:#374151; font-size:15px;">We’ve received your request for <strong>${escapeHtml(customerData.serviceType)}</strong>. A team member will reach out very soon to confirm details and next steps.</p>

            <h2 style="color: #111827; margin: 20px 0 8px;">Your Details</h2>
            <table style="width: 100%; border-collapse: collapse; background:#f9fafb; border-radius:8px;">
              <tr><td style="padding:10px; font-weight:600;">Name</td><td style="padding:10px;">${escapeHtml(customerData.name)}</td></tr>
              <tr><td style="padding:10px; font-weight:600;">Email</td><td style="padding:10px;">${escapeHtml(customerData.email)}</td></tr>
              <tr><td style="padding:10px; font-weight:600;">Phone</td><td style="padding:10px;">${escapeHtml(customerData.phone)}</td></tr>
              <tr><td style="padding:10px; font-weight:600;">Address</td><td style="padding:10px;">${escapeHtml(customerData.address)}</td></tr>
            </table>

            <h2 style="color: #111827; margin: 20px 0 8px;">Pool Information</h2>
            <table style="width: 100%; border-collapse: collapse; background:#f9fafb; border-radius:8px;">
              <tr><td style="padding:10px; font-weight:600;">Pool Type</td><td style="padding:10px;">${escapeHtml(customerData.poolType)}</td></tr>
              <tr><td style="padding:10px; font-weight:600;">Pool Size</td><td style="padding:10px;">${escapeHtml(customerData.poolSize)}</td></tr>
            </table>

            <h2 style="color: #111827; margin: 20px 0 8px;">Request Details</h2>
            <table style="width: 100%; border-collapse: collapse; background:#f9fafb; border-radius:8px;">
              <tr><td style="padding:10px; font-weight:600;">Service</td><td style="padding:10px;">${escapeHtml(customerData.serviceType)}</td></tr>
              <tr><td style="padding:10px; font-weight:600;">Priority</td><td style="padding:10px;">${escapeHtml(requestDetails.urgency.toUpperCase())}</td></tr>
              <tr><td style="padding:10px; font-weight:600;">Preferred Date</td><td style="padding:10px;">${escapeHtml(customerData.preferredDate || 'Flexible')}</td></tr>
            </table>

            <h2 style="color: #111827; margin: 20px 0 8px;">Description</h2>
            <div style="background:#f3f4f6; padding:14px; border-radius:8px; border-left: 4px solid #3b82f6; white-space:pre-wrap;">${escapeHtml(customerData.description)}</div>

            <div style="margin-top: 22px; padding: 14px; background: #e0f2fe; border-radius: 8px;">
              <p style="margin:0; color:#0c4a6e;">
                We appreciate the opportunity to serve you. Our coordinator will contact you shortly to confirm your appointment. 
                If you need immediate assistance, call <strong>601-447-0399</strong>.
              </p>
            </div>

            <p style="color:#6b7280; font-size:13px; margin-top:16px;">This confirmation was sent from Aqua Clear Pools. Save this email for your records.</p>
          </div>
        </div>`,
          ...(replyToEmail ? { ReplyTo: { Email: replyToEmail, Name: defaultFromName } } : {}),
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

    console.log("Mailjet send-service-request-email response:", mjJson);

    return new Response(
      JSON.stringify({ success: true, provider: "mailjet", response: mjJson }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-service-request-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);