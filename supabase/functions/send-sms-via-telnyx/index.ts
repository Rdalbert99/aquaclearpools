import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

const AUTH_CORS = corsHeaders;

async function requireStaff(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...AUTH_CORS },
    });
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    // Trusted server-to-server call from another edge function
    return null;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...AUTH_CORS },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: caller } = await admin
    .from("users")
    .select("id, role, status")
    .eq("id", userRes.user.id)
    .maybeSingle();

  if (!caller || caller.status !== "active" || !["admin", "tech"].includes(caller.role)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...AUTH_CORS },
    });
  }

  return null;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('=== Telnyx SMS Function Started ===');
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log('CORS preflight request received');
    return new Response(null, { headers: corsHeaders });
  }

  const authFailure = await requireStaff(req);
  if (authFailure) return authFailure;

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
      const first = responseData?.errors?.[0] ?? {};
      const detailParts = [
        first.code ? `Telnyx ${first.code}` : `Telnyx HTTP ${response.status}`,
        first.title,
        first.detail,
        first.meta?.url ? `(${first.meta.url})` : null,
      ].filter(Boolean);
      return new Response(
        JSON.stringify({
          success: false,
          provider: "telnyx",
          error: detailParts.join(": "),
          errorCode: first.code ?? null,
          errorTitle: first.title ?? null,
          errorDetail: first.detail ?? null,
          providerStatus: response.status,
          to: cleanedPhone,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
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