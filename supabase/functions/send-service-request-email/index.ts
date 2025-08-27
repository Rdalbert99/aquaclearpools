import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

    const fromEmailRaw = Deno.env.get("RESEND_FROM_EMAIL") || "no-reply@getaquaclear.com";
    const replyToEmail = Deno.env.get("RESEND_REPLY_TO") || undefined;
    const fromSafe = fromEmailRaw.includes("getaquaclear.com") ? fromEmailRaw : "no-reply@getaquaclear.com";
    const fromDisplay = fromSafe.includes("<") ? fromSafe : `AquaClear Pools <${fromSafe}>`;
    console.log(`From email resolved: ${fromDisplay}, Reply-to: ${replyToEmail}`);
    // Send email to business owner
    const businessEmailResponse = await resend.emails.send({
      from: fromDisplay,
      to: [Deno.env.get("AQUACLEAR_BUSINESS_EMAIL") || "randy@getaquaclear.com"],
      reply_to: replyToEmail,
      headers: { "List-Unsubscribe": replyToEmail ? `<mailto:${replyToEmail}>` : `<mailto:support@getaquaclear.com>` },
      subject: `New Service Request - ${customerData.serviceType} (${requestDetails.urgency} priority)`,
      text: `New ${customerData.serviceType} request (${requestDetails.urgency}) from ${customerData.name}, ${customerData.email}, ${customerData.phone}.`,
      html: `
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
        </div>
      `,
    });

    // Send confirmation email to customer
  const customerEmailResponse = await resend.emails.send({
    from: fromDisplay,
    to: [customerData.email],
    reply_to: replyToEmail,
    headers: { "List-Unsubscribe": replyToEmail ? `<mailto:${replyToEmail}>` : `<mailto:support@getaquaclear.com>` },
    subject: "Service Request Received - Aqua Clear Pools",
    text: `Thank you ${customerData.name}. We've received your ${customerData.serviceType} request (${requestDetails.urgency}).`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Thank You, ${customerData.name}!</h1>
            <p style="margin: 5px 0;">We've received your service request</p>
          </div>
          
          <div style="padding: 20px;">
            <p>Thank you for choosing Aqua Clear Pools! We've received your request for <strong>${customerData.serviceType}</strong> and will contact you within 24 hours.</p>

            <h2 style="color: #1f2937;">Request Summary</h2>
            <div style="background: #f9fafb; padding: 15px; border-radius: 5px;">
              <p><strong>Service:</strong> ${customerData.serviceType}</p>
              <p><strong>Priority:</strong> ${requestDetails.urgency}</p>
              <p><strong>Preferred Date:</strong> ${customerData.preferredDate || 'Flexible'}</p>
              <p><strong>Pool Type:</strong> ${customerData.poolType}</p>
              <p><strong>Pool Size:</strong> ${customerData.poolSize}</p>
            </div>

            <h2 style="color: #1f2937;">What Happens Next?</h2>
            <ol style="color: #4b5563;">
              <li>We'll review your request and contact you within 24 hours</li>
              <li>We'll schedule a convenient time for service or consultation</li>
              <li>Our certified technicians will provide professional service</li>
              <li>You'll receive a detailed service report</li>
            </ol>

            <div style="background: #e0f2fe; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; color: #0c4a6e;"><strong>Need immediate assistance?</strong></p>
              <p style="margin: 5px 0; color: #0c4a6e;">Call us at: <strong>601-447-0399</strong></p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://aquaclearpools.lovable.app/auth/signup" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Create Account to Track Services</a>
            </div>

            <p style="color: #6b7280; font-size: 14px;">
              Want to track your service history and manage future appointments? 
              <a href="https://aquaclearpools.lovable.app/auth/signup" style="color: #3b82f6;">Create a free account</a> 
              to access our customer portal.
            </p>
          </div>
        </div>
      `,
    });

    console.log("Emails sent successfully:", { businessEmailResponse, customerEmailResponse });

    return new Response(
      JSON.stringify({ 
        success: true, 
        businessEmail: businessEmailResponse, 
        customerEmail: customerEmailResponse 
      }), 
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