import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELNYX_API_URL = "https://api.telnyx.com/v2/messages";
const DEFAULT_FROM_NUMBER = "+16014198527";

serve(async (req: Request) => {
  console.log("=== Telnyx Inbound SMS Webhook ===");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Webhook payload:", JSON.stringify(body, null, 2));

    // Telnyx sends events in data.event_type
    const event = body?.data;
    if (!event || event.event_type !== "message.received") {
      console.log("Ignoring non-message event:", event?.event_type);
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const payload = event.payload;
    const fromNumber = payload?.from?.phone_number;
    const messageText = payload?.text;

    if (!fromNumber || !messageText) {
      console.log("Missing from number or message text");
      return new Response(JSON.stringify({ ok: true, no_action: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Inbound SMS from: ${fromNumber}`);
    console.log(`Message: ${messageText}`);

    // Create Supabase admin client to look up client and tech
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Normalize the inbound phone number for matching
    const cleanedFrom = fromNumber.replace(/\D/g, "");
    // Try matching with various formats
    const phoneVariants = [
      fromNumber,
      cleanedFrom,
      `+${cleanedFrom}`,
      cleanedFrom.length === 11 && cleanedFrom.startsWith("1") ? cleanedFrom.slice(1) : null,
      cleanedFrom.length === 10 ? `1${cleanedFrom}` : null,
      cleanedFrom.length === 10 ? `+1${cleanedFrom}` : null,
    ].filter(Boolean);

    console.log("Phone variants to search:", phoneVariants);

    // Find the client by phone number
    let client = null;
    for (const variant of phoneVariants) {
      const { data } = await supabase
        .from("clients")
        .select("id, customer, assigned_technician_id, contact_phone")
        .ilike("contact_phone", `%${variant!.slice(-10)}%`)
        .limit(1)
        .single();

      if (data) {
        client = data;
        break;
      }
    }

    if (!client) {
      console.log("No client found matching phone:", fromNumber);
      return new Response(JSON.stringify({ ok: true, no_client_match: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Matched client: ${client.customer} (${client.id})`);

    if (!client.assigned_technician_id) {
      console.log("Client has no assigned technician");
      return new Response(JSON.stringify({ ok: true, no_tech_assigned: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get the assigned tech's phone number
    const { data: tech } = await supabase
      .from("users")
      .select("id, name, phone")
      .eq("id", client.assigned_technician_id)
      .single();

    if (!tech || !tech.phone) {
      console.log("Tech not found or has no phone:", client.assigned_technician_id);
      return new Response(JSON.stringify({ ok: true, tech_no_phone: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Forwarding to tech: ${tech.name} at ${tech.phone}`);

    // Format the forwarded message
    const forwardMessage = `Reply from ${client.customer}: "${messageText}"`;

    // Clean tech phone number
    let techPhone = tech.phone.replace(/\D/g, "");
    if (techPhone.length === 10) techPhone = "1" + techPhone;
    if (!techPhone.startsWith("+")) techPhone = "+" + techPhone;

    // Send SMS to tech via Telnyx
    const telnyxApiKey = Deno.env.get("TELNYX_API_KEY");
    if (!telnyxApiKey) {
      console.error("TELNYX_API_KEY not configured");
      throw new Error("TELNYX_API_KEY not configured");
    }

    const smsPayload = {
      from: DEFAULT_FROM_NUMBER,
      to: techPhone,
      text: forwardMessage,
    };

    console.log("Sending forwarded SMS:", JSON.stringify(smsPayload, null, 2));

    const smsResponse = await fetch(TELNYX_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${telnyxApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(smsPayload),
    });

    const smsResult = await smsResponse.json();
    console.log("Telnyx forward response:", JSON.stringify(smsResult, null, 2));

    if (!smsResponse.ok) {
      console.error("Failed to forward SMS:", smsResult);
      throw new Error(`Telnyx error: ${smsResult.errors?.[0]?.detail || "Unknown"}`);
    }

    console.log("Successfully forwarded customer reply to tech!");

    return new Response(
      JSON.stringify({ ok: true, forwarded: true, tech: tech.name }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in telnyx-inbound-sms:", error);
    // Always return 200 to Telnyx to prevent retries
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
