import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

    console.log(`Sending test email to: ${recipientEmail}`);

    const emailResponse = await resend.emails.send({
      from: "AquaClear Pools <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: "🏊 Test Email from AquaClear Pools",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; text-align: center;">🏊 AquaClear Pools Test Email</h1>
          
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #0369a1; margin-top: 0;">Email System Test Successful!</h2>
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

    console.log("Test email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true,
      messageId: emailResponse.data?.id,
      recipient: recipientEmail 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in test-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);