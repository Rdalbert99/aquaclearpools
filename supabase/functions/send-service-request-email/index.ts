import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { customerData, requestDetails }: ServiceRequestData = await req.json();

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
          Subject: `New Service Request - ${customerData.serviceType} (${requestDetails.urgency} priority)`,
          TextPart: `New ${customerData.serviceType} request (${requestDetails.urgency}) from ${customerData.name}, ${customerData.email}, ${customerData.phone}.`,
          HTMLPart: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">New Service Request</h1>
            <p style="margin: 5px 0;">Aqua Clear Pools</p>
          </div>
          <div style="padding: 20px; background: #f9fafb;">
            <h2 style="color: #1f2937;">Customer Information</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; font-weight: bold;">Name:</td><td style="padding: 8px;">${customerData.name}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${customerData.email}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Phone:</td><td style="padding: 8px;">${customerData.phone}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Address:</td><td style="padding: 8px;">${customerData.address}</td></tr>
            </table>
            <h2 style="color: #1f2937; margin-top: 30px;">Pool Information</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; font-weight: bold;">Pool Type:</td><td style="padding: 8px;">${customerData.poolType}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Pool Size:</td><td style="padding: 8px;">${customerData.poolSize}</td></tr>
            </table>
            <h2 style="color: #1f2937; margin-top: 30px;">Service Request</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; font-weight: bold;">Service Type:</td><td style="padding: 8px;">${customerData.serviceType}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Urgency:</td><td style="padding: 8px; color: ${requestDetails.urgency === 'emergency' ? '#dc2626' : requestDetails.urgency === 'high' ? '#ea580c' : '#059669'};">${requestDetails.urgency.toUpperCase()}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Preferred Date:</td><td style="padding: 8px;">${customerData.preferredDate || 'Not specified'}</td></tr>
            </table>
            <h2 style="color: #1f2937; margin-top: 30px;">Description</h2>
            <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #3b82f6;">
              ${customerData.description}
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
          TextPart: `Thank you ${customerData.name}. We've received your ${customerData.serviceType} request (${requestDetails.urgency}).`,
          HTMLPart: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 24px; text-align: center;">
            <h1 style="margin: 0;">Thanks, ${customerData.name}! We received your request</h1>
            <p style="margin: 8px 0 0 0;">Aqua Clear Pools</p>
          </div>
          <div style="padding: 20px; background: #ffffff;">
            <p style="color:#374151; font-size:15px;">We’ve received your request for <strong>${customerData.serviceType}</strong>. A team member will reach out very soon to confirm details and next steps.</p>

            <h2 style="color: #111827; margin: 20px 0 8px;">Your Details</h2>
            <table style="width: 100%; border-collapse: collapse; background:#f9fafb; border-radius:8px;">
              <tr><td style="padding:10px; font-weight:600;">Name</td><td style="padding:10px;">${customerData.name}</td></tr>
              <tr><td style="padding:10px; font-weight:600;">Email</td><td style="padding:10px;">${customerData.email}</td></tr>
              <tr><td style="padding:10px; font-weight:600;">Phone</td><td style="padding:10px;">${customerData.phone}</td></tr>
              <tr><td style="padding:10px; font-weight:600;">Address</td><td style="padding:10px;">${customerData.address}</td></tr>
            </table>

            <h2 style="color: #111827; margin: 20px 0 8px;">Pool Information</h2>
            <table style="width: 100%; border-collapse: collapse; background:#f9fafb; border-radius:8px;">
              <tr><td style="padding:10px; font-weight:600;">Pool Type</td><td style="padding:10px;">${customerData.poolType}</td></tr>
              <tr><td style="padding:10px; font-weight:600;">Pool Size</td><td style="padding:10px;">${customerData.poolSize}</td></tr>
            </table>

            <h2 style="color: #111827; margin: 20px 0 8px;">Request Details</h2>
            <table style="width: 100%; border-collapse: collapse; background:#f9fafb; border-radius:8px;">
              <tr><td style="padding:10px; font-weight:600;">Service</td><td style="padding:10px;">${customerData.serviceType}</td></tr>
              <tr><td style="padding:10px; font-weight:600;">Priority</td><td style="padding:10px;">${requestDetails.urgency.toUpperCase()}</td></tr>
              <tr><td style="padding:10px; font-weight:600;">Preferred Date</td><td style="padding:10px;">${customerData.preferredDate || 'Flexible'}</td></tr>
            </table>

            <h2 style="color: #111827; margin: 20px 0 8px;">Description</h2>
            <div style="background:#f3f4f6; padding:14px; border-radius:8px; border-left: 4px solid #3b82f6; white-space:pre-wrap;">${customerData.description}</div>

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