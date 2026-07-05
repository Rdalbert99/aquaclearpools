import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatDate(iso: string): string {
  try {
    const [y, m, d] = iso.split("T")[0].split("-").map((n) => parseInt(n, 10));
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is authenticated (admin or tech)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id, cleaned_date } = await req.json();
    if (!client_id || !cleaned_date) {
      return new Response(JSON.stringify({ error: "Missing client_id or cleaned_date" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: client, error: cErr } = await admin
      .from("clients")
      .select("id, customer, contact_email, contact_phone, user_id")
      .eq("id", client_id)
      .maybeSingle();
    if (cErr || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let email = client.contact_email as string | null;
    let phone = client.contact_phone as string | null;
    if (client.user_id && (!email || !phone)) {
      const { data: u } = await admin
        .from("users")
        .select("email, phone")
        .eq("id", client.user_id)
        .maybeSingle();
      if (u) {
        email = email || (u.email as string | null);
        phone = phone || (u.phone as string | null);
      }
    }

    const prettyDate = formatDate(cleaned_date);
    const firstName = (client.customer || "there").split(/\s+/)[0];

    const smsBody = `Aqua Clear Pools: Hi ${firstName}, your salt cell was cleaned on ${prettyDate} and is back in service. Thanks for choosing us! Reply STOP to opt out.`;

    const subject = "Your salt cell has been cleaned";
    const textBody =
      `Hi ${firstName},\n\n` +
      `Just a quick note to let you know your salt cell was cleaned on ${prettyDate} and is back in service. ` +
      `Regular cleanings keep your cell producing chlorine efficiently and extend its lifespan.\n\n` +
      `If you have any questions, just reply to this email or give us a call.\n\n` +
      `Thanks for choosing Aqua Clear Pools!`;
    const htmlBody =
      `<p>Hi ${firstName},</p>` +
      `<p>Just a quick note to let you know your salt cell was cleaned on <strong>${prettyDate}</strong> and is back in service. ` +
      `Regular cleanings keep your cell producing chlorine efficiently and extend its lifespan.</p>` +
      `<p>If you have any questions, just reply to this email or give us a call.</p>` +
      `<p>Thanks for choosing <strong>Aqua Clear Pools</strong>!</p>`;

    const channels: string[] = [];
    const errors: string[] = [];

    // Send SMS
    if (phone) {
      try {
        const smsRes = await fetch(`${supabaseUrl}/functions/v1/send-sms-via-telnyx`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ to: phone, message: smsBody }),
        });
        const smsJson = await smsRes.json().catch(() => ({}));
        if (smsRes.ok && smsJson?.success !== false) {
          channels.push("SMS");
        } else {
          errors.push(`SMS failed: ${smsJson?.error || smsRes.statusText}`);
        }
      } catch (e: any) {
        errors.push(`SMS error: ${e.message}`);
      }
    }

    // Send email via Mailjet
    if (email) {
      try {
        const emailRes = await fetch(`${supabaseUrl}/functions/v1/mailjet-test-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            to: email,
            subject,
            text: textBody,
            html: htmlBody,
          }),
        });
        const emailJson = await emailRes.json().catch(() => ({}));
        if (emailRes.ok && emailJson?.success !== false) {
          channels.push("Email");
        } else {
          errors.push(`Email failed: ${JSON.stringify(emailJson?.error || emailRes.statusText)}`);
        }
      } catch (e: any) {
        errors.push(`Email error: ${e.message}`);
      }
    }

    if (!channels.length) {
      return new Response(
        JSON.stringify({ error: errors.join("; ") || "No contact method available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, channels, warnings: errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("notify-salt-cell-cleaned error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
