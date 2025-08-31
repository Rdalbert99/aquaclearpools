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

interface ServiceRequestNotification {
  requestId: string;
  customerName: string;
  customerEmail: string;
  serviceType: string;
  status: string;
  scheduledDate?: string;
  timeRange?: string;
  notes?: string;
  technicianName?: string;
  technicianPhone?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      requestId, 
      customerName, 
      customerEmail, 
      serviceType, 
      status, 
      scheduledDate, 
      timeRange, 
      notes,
      technicianName,
      technicianPhone
    }: ServiceRequestNotification = await req.json();

    console.log(`Sending service request notification: ${status} for request ${requestId}`);

    let subject = "";
    let htmlContent = "";

    if (status === "approved" || status === "in-progress") {
      subject = `Service Request Approved - ${serviceType}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Service Request Approved!</h1>
            <p style="margin: 5px 0;">Aqua Clear Pools</p>
          </div>
          
          <div style="padding: 20px;">
            <p>Hi ${customerName},</p>
            
            <p>Great news! Your service request has been approved and we're ready to get started.</p>

            <h2 style="color: #1f2937;">Service Details</h2>
            <div style="background: #f9fafb; padding: 15px; border-radius: 5px;">
              <p><strong>Service Type:</strong> ${serviceType}</p>
              <p><strong>Request ID:</strong> ${requestId}</p>
              ${scheduledDate ? `<p><strong>Scheduled Date:</strong> ${new Date(scheduledDate).toLocaleDateString()}</p>` : ''}
              ${timeRange ? `<p><strong>Time Window:</strong> ${timeRange}</p>` : ''}
            </div>

            ${notes ? `
              <h2 style="color: #1f2937;">Additional Notes</h2>
              <div style="background: #e0f2fe; padding: 15px; border-radius: 5px;">
                ${notes}
              </div>
            ` : ''}

            <h2 style="color: #1f2937;">What to Expect</h2>
            <ul style="color: #4b5563;">
              <li>Our certified technician will arrive during the scheduled time window</li>
              <li>We'll call 30 minutes before arrival</li>
              <li>All equipment and chemicals are provided</li>
              <li>You'll receive a detailed service report after completion</li>
            </ul>

            <div style="background: #e0f2fe; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; color: #0c4a6e;"><strong>Questions or need to reschedule?</strong></p>
              <p style="margin: 5px 0; color: #0c4a6e;">Call us at: <strong>601-447-0399</strong></p>
            </div>

            <p>Thank you for choosing Aqua Clear Pools!</p>
          </div>
        </div>
      `;
    } else if (status === "scheduled") {
      subject = `Service Scheduled - ${serviceType}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Service Scheduled!</h1>
            <p style="margin: 5px 0;">Aqua Clear Pools</p>
          </div>
          
          <div style="padding: 20px;">
            <p>Hi ${customerName},</p>
            
            <p>Your service has been scheduled! Here are the details:</p>

            <div style="background: #f0f9ff; padding: 20px; border-radius: 5px; border-left: 4px solid #3b82f6; margin: 20px 0;">
              <h2 style="color: #1f2937; margin-top: 0;">Appointment Details</h2>
              <p><strong>Service:</strong> ${serviceType}</p>
              <p><strong>Date:</strong> ${scheduledDate ? new Date(scheduledDate).toLocaleDateString() : 'TBD'}</p>
              <p><strong>Time:</strong> ${timeRange || 'We will contact you to confirm'}</p>
              <p><strong>Request ID:</strong> ${requestId}</p>
            </div>

            ${technicianName ? `
            <div style="background: #ecfdf5; padding: 20px; border-radius: 5px; border-left: 4px solid #10b981; margin: 20px 0;">
              <h2 style="color: #065f46; margin-top: 0;">Your Technician</h2>
              <p style="margin: 0 0 6px 0;"><strong>Name:</strong> ${technicianName}</p>
              ${technicianPhone ? `<p style="margin: 0;"><strong>Phone:</strong> <a href="tel:${technicianPhone}" style="color:#065f46; text-decoration: none;">${technicianPhone}</a></p>` : ''}
              <p style="margin: 10px 0 0 0; color:#065f46;">They will reach out prior to arrival if needed.</p>
            </div>
            ` : ''}


            ${notes ? `
              <h2 style="color: #1f2937;">Service Notes</h2>
              <div style="background: #f9fafb; padding: 15px; border-radius: 5px;">
                ${notes}
              </div>
            ` : ''}

            <h2 style="color: #1f2937;">Preparation</h2>
            <ul style="color: #4b5563;">
              <li>Please ensure pool area is accessible</li>
              <li>Secure any pets during service</li>
              <li>No need to prepare chemicals - we bring everything</li>
              <li>Someone 18+ should be available if gate access is needed</li>
            </ul>

            <div style="background: #fef3c7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e;"><strong>Important:</strong> We'll call 30 minutes before arrival to confirm.</p>
            </div>

            <div style="background: #e0f2fe; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; color: #0c4a6e;"><strong>Need to reschedule or have questions?</strong></p>
              <p style="margin: 5px 0; color: #0c4a6e;">Call us at: <strong>601-447-0399</strong></p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://aquaclearpools.lovable.app/client" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View in Customer Portal</a>
            </div>

            <p>We're looking forward to keeping your pool crystal clear!</p>
          </div>
        </div>
      `;
    } else {
      // Generic status update
      subject = `Service Request Update - ${serviceType}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #6b7280, #4b5563); color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Service Request Update</h1>
            <p style="margin: 5px 0;">Aqua Clear Pools</p>
          </div>
          
          <div style="padding: 20px;">
            <p>Hi ${customerName},</p>
            
            <p>We have an update on your service request:</p>

            <div style="background: #f9fafb; padding: 15px; border-radius: 5px;">
              <p><strong>Service:</strong> ${serviceType}</p>
              <p><strong>Status:</strong> ${status}</p>
              <p><strong>Request ID:</strong> ${requestId}</p>
            </div>

            ${notes ? `
              <h2 style="color: #1f2937;">Notes</h2>
              <div style="background: #e0f2fe; padding: 15px; border-radius: 5px;">
                ${notes}
              </div>
            ` : ''}

            <div style="background: #e0f2fe; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; color: #0c4a6e;"><strong>Questions?</strong></p>
              <p style="margin: 5px 0; color: #0c4a6e;">Call us at: <strong>601-447-0399</strong></p>
            </div>

            <p>Thank you for choosing Aqua Clear Pools!</p>
          </div>
        </div>
      `;
    }

    const replyToEmail = Deno.env.get("RESEND_REPLY_TO") || undefined;
    const defaultFromEmail = "randy@getaquaclear.com";
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
          To: [{ Email: customerEmail }],
          Bcc: [
            { Email: "randy@getaquaclear.com" },
            { Email: "rdalbert99@gmail.com" },
            { Email: "untoothers@hotmail.com" }
          ],
          Subject: subject,
          HTMLPart: htmlContent,
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

    console.log("Service notification email sent successfully (Mailjet):", mjJson);

    return new Response(
      JSON.stringify({ 
        success: true, 
        provider: "mailjet",
        response: mjJson,
        message: `${status} notification sent to ${customerEmail}`
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
    console.error("Error in service-request-notify function:", error);
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