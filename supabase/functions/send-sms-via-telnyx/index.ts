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
  console.log('=== Telnyx SMS Function Started ===');
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log('CORS preflight request received');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Checking Telnyx API key...');
    const apiKey = Deno.env.get("TELNYX_API_KEY");
    if (!apiKey) {
      console.error('TELNYX_API_KEY is not configured');
      throw new Error("TELNYX_API_KEY is not configured");
    }
    console.log('Telnyx API key found:', apiKey.substring(0, 10) + '...');

    console.log('Parsing request body...');
    const { to, message, from }: SendSMSRequest = await req.json();
    console.log('Request payload:', { to, message, from: from || 'using default' });
    
    if (!to || !message) {
      console.error('Missing required fields:', { to: !!to, message: !!message });
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, message" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Clean and validate phone number
    console.log('Original phone number:', to);
    let cleanedPhone = to.replace(/\D/g, "");
    console.log('After removing non-digits:', cleanedPhone);
    
    if (cleanedPhone.length === 10) {
      cleanedPhone = "1" + cleanedPhone; // Add US country code
      console.log('Added US country code:', cleanedPhone);
    }
    if (!cleanedPhone.startsWith("+")) {
      cleanedPhone = "+" + cleanedPhone;
      console.log('Added + prefix:', cleanedPhone);
    }

    console.log(`Final phone number: ${cleanedPhone}`);
    console.log(`Message to send: ${message}`);
    console.log(`From number: ${from || DEFAULT_FROM_NUMBER}`);

    const payload = {
      from: from || DEFAULT_FROM_NUMBER,
      to: cleanedPhone,
      text: message
    };

    console.log('Telnyx API payload:', JSON.stringify(payload, null, 2));
    console.log('Making request to Telnyx API...');

    const response = await fetch(TELNYX_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();
    console.log('Telnyx API Status:', response.status);
    console.log('Telnyx API Response Headers:', Object.fromEntries(response.headers.entries()));
    console.log('Telnyx API Response Body:', JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      console.error("Telnyx API error:", responseData);
      throw new Error(`Telnyx API error: ${responseData.errors?.[0]?.detail || 'Unknown error'}`);
    }

    console.log("SMS sent successfully via Telnyx!");
    console.log("Message ID:", responseData.data?.id);
    console.log("Message Status:", responseData.data?.to);
    console.log("Full Response:", responseData);

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