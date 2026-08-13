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


const GSM_BASIC =
  "@\u00a3$\u00a5\u00e8\u00e9\u00f9\u00ec\u00f2\u00c7\n\u00d8\u00f8\r\u00c5\u00e5\u0394_\u03a6\u0393\u039b\u03a9\u03a0\u03a8\u03a3\u0398\u039e\u00c6\u00e6\u00df\u00c9 !\"#\u00a4%&'()*+,-./0123456789:;<=>?" +
  "\u00a1ABCDEFGHIJKLMNOPQRSTUVWXYZ\u00c4\u00d6\u00d1\u00dc\u00a7\u00bfabcdefghijklmnopqrstuvwxyz\u00e4\u00f6\u00f1\u00fc\u00e0";
const GSM_EXTENDED = "^{}\\[~]|\u20ac";

function analyzeMessage(text: string) {
  const chars = Array.from(text);
  const nonGsm = [...new Set(chars.filter(c => !GSM_BASIC.includes(c) && !GSM_EXTENDED.includes(c)))];
  const isGsm = nonGsm.length === 0;
  const units = isGsm
    ? chars.reduce((n, c) => n + (GSM_EXTENDED.includes(c) ? 2 : 1), 0)
    : chars.reduce((n, c) => n + ((c.codePointAt(0) ?? 0) > 0xffff ? 2 : 1), 0);
  const single = isGsm ? 160 : 70;
  const multi = isGsm ? 153 : 67;
  const segments = units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / multi);
  return {
    characters: chars.length,
    encoding: isGsm ? "GSM-7" : "UCS-2",
    units,
    segments,
    maxSegments: 10,
    overLimit: segments > 10,
    nonGsmCharacters: nonGsm.slice(0, 20),
    nonGsmCodePoints: nonGsm.slice(0, 20).map(c => "U+" + (c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")),
  };
}

function maskPhone(p: string) {
  return p.length > 4 ? `${p.slice(0, -4).replace(/\d/g, "*")}${p.slice(-4)}` : p;
}

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
    console.log('Request payload:', { to: maskPhone(String(to ?? '')), messageLength: message?.length ?? 0, from: from || 'using default' });
    
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
    console.log('Original phone number:', maskPhone(to));
    let cleanedPhone = to.replace(/\D/g, "");
    console.log('After removing non-digits:', maskPhone(cleanedPhone));
    
    if (cleanedPhone.length === 10) {
      cleanedPhone = "1" + cleanedPhone; // Add US country code
      console.log('Added US country code:', maskPhone(cleanedPhone));
    }
    if (!cleanedPhone.startsWith("+")) {
      cleanedPhone = "+" + cleanedPhone;
      console.log('Added + prefix:', maskPhone(cleanedPhone));
    }

    console.log(`Final phone number: ${maskPhone(cleanedPhone)}`);
    console.log(`From number: ${from || DEFAULT_FROM_NUMBER}`);

    const analysis = analyzeMessage(message);
    console.log('Message analysis:', JSON.stringify(analysis));
    if (analysis.overLimit) {
      console.error(
        `Message exceeds Telnyx segment limit: ${analysis.segments} parts (max ${analysis.maxSegments}), ` +
        `encoding ${analysis.encoding}, ${analysis.characters} chars. ` +
        `Non-GSM characters forcing UCS-2: ${analysis.nonGsmCodePoints.join(', ') || 'none'}`,
      );
    }
    console.log('Message head:', JSON.stringify(message.slice(0, 200)));
    console.log('Message tail:', JSON.stringify(message.slice(-200)));

    const payload = {
      from: from || DEFAULT_FROM_NUMBER,
      to: cleanedPhone,
      text: message
    };

    console.log('Telnyx API payload (redacted):', JSON.stringify({
      from: payload.from,
      to: maskPhone(payload.to),
      textLength: payload.text.length,
      segments: analysis.segments,
      encoding: analysis.encoding,
    }));
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
      console.error('Telnyx send failed diagnostics:', JSON.stringify({
        status: response.status,
        code: first.code ?? null,
        title: first.title ?? null,
        detail: first.detail ?? null,
        to: maskPhone(cleanedPhone),
        from: payload.from,
        requestId: response.headers.get('x-request-id'),
        ...analysis,
      }));
      return new Response(
        JSON.stringify({
          success: false,
          provider: "telnyx",
          error: detailParts.join(": "),
          diagnostics: {
            characters: analysis.characters,
            encoding: analysis.encoding,
            segments: analysis.segments,
            maxSegments: analysis.maxSegments,
            overLimit: analysis.overLimit,
            nonGsmCharacters: analysis.nonGsmCharacters,
            requestId: response.headers.get('x-request-id'),
          },
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
    console.log("Send summary:", JSON.stringify({
      messageId: responseData.data?.id,
      to: maskPhone(cleanedPhone),
      parts: responseData.data?.parts ?? analysis.segments,
      encoding: responseData.data?.encoding ?? analysis.encoding,
      characters: analysis.characters,
    }));

    return new Response(
      JSON.stringify({ 
        success: true, 
        provider: "telnyx",
        messageId: responseData.data?.id,
        to: cleanedPhone,
        diagnostics: {
          characters: analysis.characters,
          encoding: responseData.data?.encoding ?? analysis.encoding,
          segments: responseData.data?.parts ?? analysis.segments,
        },
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