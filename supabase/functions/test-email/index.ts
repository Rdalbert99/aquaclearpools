import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

// Resend client will be initialized inside the handler after validating the API key

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  recipientEmail: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmail }: TestEmailRequest = await req.json();

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      console.error("Missing RESEND_API_KEY secret");
      return new Response(
        JSON.stringify({ success: false, error: { message: "Missing RESEND_API_KEY secret" } }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Initialize Resend client only after verifying API key to avoid boot errors
    const resend = new Resend(apiKey);

    console.log(`Sending test email to: ${recipientEmail}`);

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "AquaClear Pools <onboarding@resend.dev>";
    const replyToEmail = Deno.env.get("RESEND_REPLY_TO");
    
    console.log(`From email: ${fromEmail}, Reply-to: ${replyToEmail}`);
    
    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: [recipientEmail],
      reply_to: replyToEmail,
      subject: "🏊 Test Email from AquaClear Pools",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; text-align: center;">🏊 AquaClear Pools Test Email</h1>
          
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #0369a1; margin-top: 0;">Email System Test</h2>
            <p>This is a test email to verify that your email sending functionality is working correctly.</p>
            <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Recipient:</strong> ${recipientEmail}</p>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center; color: #6b7280;">
            <p>This email was sent from your AquaClear Pools management system.</p>
            <p style="font-size: 12px;">If you received this email in error, please ignore it.</p>
          </div>
        </div>
      `,
    });

    if (emailResponse.error) {
      console.error("Resend error:", emailResponse.error);
      const statusCode = (emailResponse.error as any).statusCode ?? 400;
      const message = (emailResponse.error as any).message || (emailResponse.error as any).error || "Unknown Resend error";
      const hint = statusCode === 403 && (Deno.env.get("RESEND_FROM_EMAIL") || "").includes("resend.dev")
        ? "Resend sandbox: Verify a domain at https://resend.com/domains and set RESEND_FROM_EMAIL to a verified sender (e.g., no-reply@yourdomain.com)."
        : undefined;
      return new Response(
        JSON.stringify({
          success: false,
          error: { message, statusCode, hint },
          provider: "resend",
          recipient: recipientEmail,
        }),
        {
          status: statusCode,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Test email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, messageId: emailResponse.data?.id, recipient: recipientEmail }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in test-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: { message: error.message } }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);