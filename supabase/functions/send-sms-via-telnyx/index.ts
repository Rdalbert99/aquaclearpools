import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendSMSRequest {
  to: string;
  message: string;
  from?: string; // Optional, will use default if not provided
}

const TELNYX_API_URL = "https://api.telnyx.com/v2/messages";
const DEFAULT_FROM_NUMBER = "+16014198527"; // Your Telnyx number

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("TELNYX_API_KEY");
    if (!apiKey) {
      throw new Error("TELNYX_API_KEY is not configured");
    }

    const { to, message, from }: SendSMSRequest = await req.json();
    
    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, message" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Clean and validate phone number
    let cleanedPhone = to.replace(/\D/g, "");
    if (cleanedPhone.length === 10) {
      cleanedPhone = "1" + cleanedPhone; // Add US country code
    }
    if (!cleanedPhone.startsWith("+")) {
      cleanedPhone = "+" + cleanedPhone;
    }

    console.log(`Sending SMS via Telnyx to ${cleanedPhone}: ${message}`);

    const payload = {
      from: from || DEFAULT_FROM_NUMBER,
      to: cleanedPhone,
      text: message
    };

    const response = await fetch(TELNYX_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Telnyx API error:", responseData);
      throw new Error(`Telnyx API error: ${responseData.errors?.[0]?.detail || 'Unknown error'}`);
    }

    console.log("SMS sent successfully via Telnyx:", responseData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        provider: "telnyx",
        messageId: responseData.data?.id,
        to: cleanedPhone,
        message: "SMS sent successfully"
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
    console.error("Error in send-sms-via-telnyx function:", error);
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