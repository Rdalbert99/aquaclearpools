import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELNYX_API_URL = "https://api.telnyx.com/v2/messages";
const DEFAULT_FROM_NUMBER = "+16014198527";

type ForwardRecipient = {
  id: string;
  recipient_type: "assigned_tech" | "admin_user" | "tech_user" | "custom";
  label: string;
  user_id: string | null;
  phone_number: string | null;
  is_enabled: boolean;
};

type ResolvedRecipient = {
  key: string;
  label: string;
  phone: string;
  isAssignedTech: boolean;
};

const normalizePhone = (value?: string | null) => {
  if (!value) return null;
  let cleaned = value.replace(/\D/g, "");
  if (cleaned.length === 10) cleaned = `1${cleaned}`;
  if (!cleaned || cleaned.length < 10) return null;
  return `+${cleaned}`;
};

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

    const { data: forwardingSettings, error: settingsError } = await supabase
      .from("sms_forwarding_recipients")
      .select("id, recipient_type, label, user_id, phone_number, is_enabled")
      .eq("is_enabled", true);

    if (settingsError) {
      console.error("Failed to load SMS forwarding settings:", settingsError);
    }

    const enabledSettings = ((forwardingSettings || []) as ForwardRecipient[]).length
      ? ((forwardingSettings || []) as ForwardRecipient[])
      : [{
          id: "assigned-tech-fallback",
          recipient_type: "assigned_tech",
          label: "Assigned technician",
          user_id: null,
          phone_number: null,
          is_enabled: true,
        }];

    const userIds = enabledSettings
      .filter((recipient) => recipient.recipient_type !== "assigned_tech" && recipient.user_id)
      .map((recipient) => recipient.user_id as string);

    const usersById = new Map<string, { id: string; name: string; phone: string | null; role: string }>();
    if (userIds.length) {
      const { data: recipientUsers, error: usersError } = await supabase
        .from("users")
        .select("id, name, phone, role")
        .in("id", userIds);

      if (usersError) {
        console.error("Failed to load SMS forwarding users:", usersError);
      }

      for (const recipientUser of recipientUsers || []) {
        usersById.set(recipientUser.id, recipientUser);
      }
    }

    const recipients = new Map<string, ResolvedRecipient>();
    for (const setting of enabledSettings) {
      if (setting.recipient_type === "assigned_tech") {
        const phone = normalizePhone(tech?.phone);
        if (!client || !tech || !phone) continue;
        recipients.set(phone, {
          key: setting.id,
          label: `Assigned tech: ${tech.name}`,
          phone,
          isAssignedTech: true,
        });
        continue;
      }

      if (setting.user_id) {
        const recipientUser = usersById.get(setting.user_id);
        const phone = normalizePhone(recipientUser?.phone || setting.phone_number);
        if (!phone) continue;
        recipients.set(phone, {
          key: setting.id,
          label: recipientUser?.name || setting.label,
          phone,
          isAssignedTech: false,
        });
        continue;
      }

      const phone = normalizePhone(setting.phone_number);
      if (!phone) continue;
      recipients.set(phone, {
        key: setting.id,
        label: setting.label,
        phone,
        isAssignedTech: false,
      });
    }

    let forwarded = false;
    let assignedTechForwarded = false;
    const forwardedToRecipients: string[] = [];
    const forwardErrors: string[] = [];
    const telnyxApiKey = Deno.env.get("TELNYX_API_KEY");

    if (recipients.size && telnyxApiKey) {
      const senderName = client?.customer || fromNumber;
      const forwardMessage = `Customer reply from ${senderName}: "${messageText}"`;

      for (const recipient of recipients.values()) {
        const smsResponse = await fetch(TELNYX_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${telnyxApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from: DEFAULT_FROM_NUMBER, to: recipient.phone, text: forwardMessage }),
        });

        const smsResult = await smsResponse.json();
        console.log(`Telnyx forward response for ${recipient.label}:`, JSON.stringify(smsResult, null, 2));

        if (smsResponse.ok) {
          forwarded = true;
          assignedTechForwarded = assignedTechForwarded || recipient.isAssignedTech;
          forwardedToRecipients.push(recipient.label);
        } else {
          forwardErrors.push(`${recipient.label}: ${smsResult?.errors?.[0]?.detail || smsResponse.statusText}`);
        }
      }
    } else if (recipients.size && !telnyxApiKey) {
      console.error("TELNYX_API_KEY not configured");
      forwardErrors.push("TELNYX_API_KEY not configured");
    } else {
      console.log("No enabled SMS forwarding recipients with valid phone numbers");
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
        forwarded_to_tech: assignedTechForwarded,
        forwarded_to_recipients: forwardedToRecipients,
        forward_error: forwardErrors.length ? forwardErrors.join("; ") : null,
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
      JSON.stringify({ ok: true, forwarded, forwarded_to: forwardedToRecipients, stored: !insertError, client: client?.customer }),
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
