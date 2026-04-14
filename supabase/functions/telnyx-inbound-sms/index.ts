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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Normalize the inbound phone number for matching
    const cleanedFrom = fromNumber.replace(/\D/g, "");
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

    // Get tech info if client found
    let tech: { id: string; name: string; phone: string } | null = null;
    if (client?.assigned_technician_id) {
      const { data: techData } = await supabase
        .from("users")
        .select("id, name, phone")
        .eq("id", client.assigned_technician_id)
        .single();
      if (techData) tech = techData;
    }

    // Forward SMS to tech if possible
    let forwarded = false;
    if (client && tech?.phone) {
      const telnyxApiKey = Deno.env.get("TELNYX_API_KEY");
      if (telnyxApiKey) {
        let techPhone = tech.phone.replace(/\D/g, "");
        if (techPhone.length === 10) techPhone = "1" + techPhone;
        if (!techPhone.startsWith("+")) techPhone = "+" + techPhone;

        const forwardMessage = `Reply from ${client.customer}: "${messageText}"`;
        const smsResponse = await fetch(TELNYX_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${telnyxApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from: DEFAULT_FROM_NUMBER, to: techPhone, text: forwardMessage }),
        });

        const smsResult = await smsResponse.json();
        console.log("Telnyx forward response:", JSON.stringify(smsResult, null, 2));
        forwarded = smsResponse.ok;
      } else {
        console.error("TELNYX_API_KEY not configured");
      }
    }

    // Store message in database for admin viewing
    const { error: insertError } = await supabase
      .from("inbound_sms_messages")
      .insert({
        from_number: fromNumber,
        message_text: messageText,
        client_id: client?.id || null,
        client_name: client?.customer || null,
        technician_id: tech?.id || null,
        technician_name: tech?.name || null,
        forwarded_to_tech: forwarded,
      });

    if (insertError) {
      console.error("Failed to store inbound SMS:", insertError);
    } else {
      console.log("Inbound SMS stored in database");
    }

    if (!client) {
      console.log("No client found matching phone:", fromNumber);
    }

    return new Response(
      JSON.stringify({ ok: true, forwarded, stored: !insertError, client: client?.customer }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in telnyx-inbound-sms:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
