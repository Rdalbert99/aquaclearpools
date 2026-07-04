import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SALT_INTERVAL_DAYS = 180;

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Load salt pools
    const { data: clients, error: cErr } = await supabase
      .from("clients")
      .select("id, customer, pool_type, assigned_technician_id, last_service_date")
      .ilike("pool_type", "%salt%");
    if (cErr) throw cErr;
    if (!clients?.length) {
      return new Response(JSON.stringify({ ok: true, checked: 0, alerted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientIds = clients.map((c) => c.id);

    // 2. Load most recent salt cell cleaning per client
    const { data: services } = await supabase
      .from("services")
      .select("client_id, service_date, actions")
      .in("client_id", clientIds)
      .contains("actions", { salt_cell_cleaned: true })
      .order("service_date", { ascending: false });

    const lastClean = new Map<string, string>();
    (services || []).forEach((s: any) => {
      if (!lastClean.has(s.client_id)) lastClean.set(s.client_id, s.service_date);
    });

    // 3. Determine which are currently due
    const today = new Date();
    const dueList: { client: any; cycleKey: string }[] = [];
    for (const client of clients) {
      const last = lastClean.get(client.id);
      let isDue = false;
      let cycleKey = "";
      if (!last) {
        // Never cleaned — flag only if we have some service history at least 180d old
        if (client.last_service_date) {
          const first = new Date(client.last_service_date);
          if (daysBetween(today, first) >= SALT_INTERVAL_DAYS) {
            isDue = true;
            cycleKey = "never";
          }
        }
      } else {
        const lastD = new Date(last);
        if (daysBetween(today, lastD) >= SALT_INTERVAL_DAYS) {
          isDue = true;
          cycleKey = last;
        }
      }
      if (isDue) dueList.push({ client, cycleKey });
    }

    if (!dueList.length) {
      return new Response(JSON.stringify({ ok: true, checked: clients.length, alerted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Load admins
    const { data: admins } = await supabase
      .from("users")
      .select("id, name, phone")
      .eq("role", "admin")
      .eq("status", "active");

    let alertedCount = 0;
    const smsPromises: Promise<any>[] = [];

    for (const { client, cycleKey } of dueList) {
      // Dedupe: try to insert alert log row
      const { error: logErr } = await supabase
        .from("salt_cell_alert_log")
        .insert({ client_id: client.id, cycle_key: cycleKey });
      if (logErr) continue; // unique-conflict → already alerted for this cycle

      // Recipient user IDs: admins + assigned tech
      const recipients = new Map<string, { phone: string | null }>();
      (admins || []).forEach((a: any) => recipients.set(a.id, { phone: a.phone }));

      let techPhone: string | null = null;
      if (client.assigned_technician_id) {
        const { data: tech } = await supabase
          .from("users")
          .select("id, phone, status")
          .eq("id", client.assigned_technician_id)
          .maybeSingle();
        if (tech && tech.status === "active") {
          recipients.set(tech.id, { phone: tech.phone });
          techPhone = tech.phone;
        }
      }

      const title = "Salt cell cleaning due";
      const body = `${client.customer}'s salt cell is due for cleaning (6+ months since last clean).`;

      // Insert notifications
      const rows = [...recipients.entries()].map(([user_id]) => ({
        user_id,
        type: "salt_cell_due",
        title,
        body,
        client_id: client.id,
        link_url: `/tech/service/${client.id}`,
      }));
      if (rows.length) {
        await supabase.from("notifications").insert(rows);
      }

      // Send SMS to admins + assigned tech
      const phones = [...recipients.values()].map((r) => r.phone).filter(Boolean) as string[];
      const smsText = `Aqua Clear Pools: ${body}`;
      for (const phone of phones) {
        smsPromises.push(
          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms-via-telnyx`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ to: phone, message: smsText }),
          }).catch((e) => console.error("SMS send failed", e)),
        );
      }

      alertedCount++;
    }

    await Promise.allSettled(smsPromises);

    return new Response(
      JSON.stringify({ ok: true, checked: clients.length, alerted: alertedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("check-salt-cell-due error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
