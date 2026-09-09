import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const MJ_API_URL = "https://api.mailjet.com/v3.1/send";
const CHICAGO_TZ = "America/Chicago";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function encodeBasicAuth(key: string, secret: string) {
  try { return btoa(`${key}:${secret}`); } catch {
    // @ts-ignore Buffer fallback
    return Buffer.from(`${key}:${secret}`).toString("base64");
  }
}

/* ---------------- Chemistry bands (mirror of src/lib/commercial.ts) ---------------- */
interface ChemRange {
  key: string; label: string; unit: string;
  ideal: [number, number]; acceptable: [number, number]; safe: [number, number];
  decimals: number;
}
type Status = "normal" | "monitor" | "attention_needed" | "action_required";
const STATUS_LABEL: Record<Status, string> = {
  normal: "Normal", monitor: "Monitor", attention_needed: "Attention needed", action_required: "Action required",
};
const STATUS_RANK: Record<Status, number> = { normal: 0, monitor: 1, attention_needed: 2, action_required: 3 };
const worst = (...s: Status[]): Status =>
  s.reduce<Status>((w, c) => (STATUS_RANK[c] > STATUS_RANK[w] ? c : w), "normal");

const CHEM_RANGES: ChemRange[] = [
  { key: "chlorine", label: "Free Chlorine", unit: "ppm", ideal: [2, 4], acceptable: [1, 6], safe: [1, 10], decimals: 1 },
  { key: "ph", label: "pH", unit: "", ideal: [7.4, 7.6], acceptable: [7.2, 7.8], safe: [7.0, 8.0], decimals: 1 },
  { key: "alkalinity", label: "Total Alkalinity", unit: "ppm", ideal: [80, 120], acceptable: [60, 180], safe: [40, 240], decimals: 0 },
  { key: "cyanuric_acid", label: "Cyanuric Acid", unit: "ppm", ideal: [30, 50], acceptable: [20, 80], safe: [0, 100], decimals: 0 },
  { key: "calcium", label: "Calcium Hardness", unit: "ppm", ideal: [200, 400], acceptable: [150, 600], safe: [100, 800], decimals: 0 },
  { key: "salt", label: "Salt", unit: "ppm", ideal: [2700, 3400], acceptable: [2400, 4000], safe: [1500, 6000], decimals: 0 },
];

function chemStatus(range: ChemRange, value: number | null): Status {
  if (value === null || Number.isNaN(value)) return "normal";
  if (value < range.safe[0] || value > range.safe[1]) return "action_required";
  if (value < range.acceptable[0] || value > range.acceptable[1]) return "attention_needed";
  if (value < range.ideal[0] || value > range.ideal[1]) return "monitor";
  return "normal";
}

// deno-lint-ignore no-explicit-any
function readingsFromService(s: any): Record<string, number | null> {
  const blob = (s.readings ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    chlorine: s.chlorine_level ?? num(blob.chlorine ?? blob.free_chlorine ?? blob.fc),
    ph: s.ph_level ?? num(blob.ph),
    alkalinity: s.alkalinity_level ?? num(blob.alkalinity ?? blob.ta),
    cyanuric_acid: s.cyanuric_acid_level ?? num(blob.cyanuric_acid ?? blob.cya),
    calcium: s.calcium_hardness_level ?? num(blob.calcium ?? blob.calcium_hardness ?? blob.ch),
    salt: num(blob.salt),
  };
}

const ISSUE_LABEL: Record<string, string> = {
  new: "New", monitoring: "Monitoring", warranty_contacted: "Warranty contacted",
  service_scheduled: "Service scheduled", waiting_on_parts: "Waiting on parts",
  repair_in_progress: "Repair in progress", completed: "Completed",
};

function chicagoParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: CHICAGO_TZ, year: "numeric", month: "numeric", day: "numeric",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function isLastDayOfMonth(d: Date) {
  const { year, month, day } = chicagoParts(d);
  return day === new Date(year, month, 0).getDate();
}

function periodFromDate(d: Date) {
  const { year, month } = chicagoParts(d);
  return {
    key: `${year}-${String(month).padStart(2, "0")}`,
    title: new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    startISO: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
    endISO: new Date(Date.UTC(year, month, 1)).toISOString(),
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({})) as {
      mode?: string; period?: string; facility_id?: string;
    };
    const manual = body.mode === "manual";
    const now = new Date();

    // Automatic runs only fire on the last day of the month (Chicago time).
    if (!manual && !isLastDayOfMonth(now)) {
      return json({ ok: true, skipped: true, reason: "Not the last day of the month (America/Chicago)" });
    }

    let period = periodFromDate(now);
    if (body.period && /^\d{4}-\d{2}$/.test(body.period)) {
      const [y, m] = body.period.split("-").map(Number);
      period = {
        key: body.period,
        title: new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        startISO: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
        endISO: new Date(Date.UTC(y, m, 1)).toISOString(),
      };
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const apiKey = Deno.env.get("MAILJET_API_KEY");
    const apiSecret = Deno.env.get("MAILJET_API_SECRET");
    if (!apiKey || !apiSecret) throw new Error("Missing MAILJET_API_KEY/MAILJET_API_SECRET");
    const auth = encodeBasicAuth(apiKey, apiSecret);

    // Facilities with recipients
    let facQuery = supabase
      .from("facilities")
      .select("id, name, organization_id, commercial_organizations(name, billing_email)")
      .eq("active", true);
    if (body.facility_id) facQuery = facQuery.eq("id", body.facility_id);
    const { data: facilities, error: facErr } = await facQuery;
    if (facErr) throw facErr;

    const { data: orgUsers, error: ouErr } = await supabase
      .from("commercial_org_users")
      .select("organization_id, facility_id, user_id")
      .eq("receives_monthly_report", true);
    if (ouErr) throw ouErr;

    const userIds = [...new Set((orgUsers ?? []).map((m) => m.user_id))];
    const { data: users } = userIds.length
      ? await supabase.from("users").select("id, email, name").in("id", userIds)
      : { data: [] };
    const emailByUser = new Map((users ?? []).map((u) => [u.id, { email: u.email, name: u.name }]));

    const results: { facility: string; status: string; recipients: number; detail?: string }[] = [];

    for (const f of facilities ?? []) {
      // deno-lint-ignore no-explicit-any
      const org = (f as any).commercial_organizations ?? {};
      const orgId = f.organization_id as string;

      const recipients = new Set<string>();
      (orgUsers ?? [])
        .filter((m) => m.organization_id === orgId && (!m.facility_id || m.facility_id === f.id))
        .forEach((m) => {
          const u = emailByUser.get(m.user_id);
          if (u?.email) recipients.add(u.email);
        });
      if (org.billing_email) recipients.add(org.billing_email);

      if (recipients.size === 0) {
        results.push({ facility: f.name, status: "skipped", recipients: 0, detail: "No recipients opted in" });
        continue;
      }

      // Idempotency: one successful send per facility per month
      const { data: prior } = await supabase
        .from("commercial_monthly_report_sends")
        .select("id")
        .eq("facility_id", f.id)
        .eq("period_key", period.key)
        .eq("status", "sent")
        .maybeSingle();
      if (prior && !manual) {
        results.push({ facility: f.name, status: "skipped", recipients: 0, detail: "Already sent for this period" });
        continue;
      }

      // Data
      const { data: pools } = await supabase
        .from("pools").select("id, name, client_id").eq("facility_id", f.id).eq("active", true);
      const clientIds = (pools ?? []).map((p) => p.client_id).filter(Boolean);

      const { data: services } = clientIds.length
        ? await supabase.from("services").select("*")
            .in("client_id", clientIds)
            .gte("performed_at", period.startISO).lt("performed_at", period.endISO)
            .order("performed_at")
        : { data: [] };

      const serviceIds = (services ?? []).map((s) => s.id);
      const { data: usage } = serviceIds.length
        ? await supabase.from("service_chemical_usage")
            .select("chemical_label, unit, quantity_used").in("service_id", serviceIds.slice(0, 800))
        : { data: [] };

      const { data: issues } = await supabase.from("equipment_issues")
        .select("title, status, opened_at, closed_at").eq("facility_id", f.id);

      const usageTotals = new Map<string, { label: string; unit: string; qty: number }>();
      (usage ?? []).forEach((u) => {
        const key = `${u.chemical_label}|${u.unit}`;
        const e = usageTotals.get(key) ?? { label: u.chemical_label, unit: u.unit, qty: 0 };
        e.qty += Number(u.quantity_used) || 0;
        usageTotals.set(key, e);
      });

      const readingStats = CHEM_RANGES.map((range) => {
        const values = (services ?? [])
          .map((s) => readingsFromService(s)[range.key])
          .filter((v): v is number => v !== null && v !== undefined);
        if (!values.length) return null;
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return { range, avg, min: Math.min(...values), max: Math.max(...values),
                 status: worst(...values.map((v) => chemStatus(range, v))) };
      }).filter(Boolean) as { range: ChemRange; avg: number; min: number; max: number; status: Status }[];

      const inPeriod = (iso: string | null) =>
        iso && iso >= period.startISO && iso < period.endISO;
      const opened = (issues ?? []).filter((i) => inPeriod(i.opened_at));
      const closed = (issues ?? []).filter((i) => inPeriod(i.closed_at));
      const openNow = (issues ?? []).filter((i) => i.status !== "completed");

      const overall = worst(
        ...readingStats.map((r) => r.status),
        ...(openNow.length ? (["attention_needed"] as Status[]) : []),
      );

      const statusColor: Record<Status, string> = {
        normal: "#059669", monitor: "#0284c7", attention_needed: "#d97706", action_required: "#dc2626",
      };

      const chemRows = readingStats.map((r) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${esc(r.range.label)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${r.avg.toFixed(r.range.decimals)}${r.range.unit ? " " + r.range.unit : ""} <span style="color:#6b7280;font-size:12px;">(${r.min}–${r.max})</span></td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:${statusColor[r.status]};font-weight:600;">${STATUS_LABEL[r.status]}</td>
        </tr>`).join("");

      const usageRows = [...usageTotals.values()].map((u) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${esc(u.label)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${Number(u.qty.toFixed(2))} ${esc(u.unit)}</td>
        </tr>`).join("");

      const visitRows = (services ?? []).map((s) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${new Date(s.performed_at).toLocaleDateString("en-US")}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${s.status ? esc(s.status) : "completed"}</td>
        </tr>`).join("");

      const openIssueItems = openNow.map((i) =>
        `<li style="margin:4px 0;">${esc(i.title)} — ${esc(ISSUE_LABEL[i.status] ?? i.status)}</li>`).join("");

      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;">
          <div style="background:#0d47a1;padding:24px;text-align:center;">
            <img src="https://getaquaclear.com/aqua-clear-logo-dark.png" alt="Aqua Clear Pools" width="180" style="max-width:60%;height:auto;" />
          </div>
          <div style="padding:24px;">
            <h1 style="margin:0 0 4px;font-size:20px;color:#0f172a;">Monthly Executive Summary</h1>
            <p style="margin:0 0 16px;color:#64748b;font-size:14px;">${esc(org.name ?? "")} — ${esc(f.name)} · ${esc(period.title)}</p>
            <div style="border:1px solid ${statusColor[overall]};border-radius:8px;padding:12px 16px;margin-bottom:20px;">
              <span style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;">Overall status</span><br/>
              <span style="font-size:18px;font-weight:700;color:${statusColor[overall]};">${STATUS_LABEL[overall]}</span>
              <span style="font-size:13px;color:#64748b;"> · ${(services ?? []).length} service visits</span>
            </div>
            <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;">Water chemistry averages</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">${chemRows || `<tr><td style="padding:8px 12px;color:#6b7280;">No tests recorded this month.</td></tr>`}</table>
            <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;">Chemicals used</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">${usageRows || `<tr><td style="padding:8px 12px;color:#6b7280;">None recorded.</td></tr>`}</table>
            <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;">Service visits</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">${visitRows || `<tr><td style="padding:8px 12px;color:#6b7280;">No visits recorded this month.</td></tr>`}</table>
            <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;">Equipment & issues</h2>
            <p style="font-size:14px;color:#0f172a;">${opened.length} opened · ${closed.length} completed · ${openNow.length} currently open</p>
            ${openIssueItems ? `<ul style="font-size:13px;color:#475569;padding-left:18px;">${openIssueItems}</ul>` : ""}
            <div style="text-align:center;margin:28px 0 8px;">
              <a href="https://getaquaclear.com/commercial/portal" style="background:#0d47a1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">View full details in your portal</a>
            </div>
            <p style="font-size:12px;color:#94a3b8;text-align:center;margin-top:24px;">
              Aqua Clear Pools · Professional Pool Service · <a href="https://getaquaclear.com" style="color:#0d47a1;">getaquaclear.com</a> · 601-447-0399
            </p>
          </div>
        </div>`;

      const text = [
        `Aqua Clear Pools — Monthly Executive Summary`,
        `${org.name ?? ""} — ${f.name}`, `Period: ${period.title}`,
        `Overall status: ${STATUS_LABEL[overall]}`,
        `Service visits: ${(services ?? []).length}`,
        `Issues: ${opened.length} opened, ${closed.length} completed, ${openNow.length} open`,
        `Details: https://getaquaclear.com/commercial/portal`,
      ].join("\n");

      const mjRes = await fetch(MJ_API_URL, {
        method: "POST",
        headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          Messages: [{
            From: { Email: "randy@getaquaclear.com", Name: "Aqua Clear Pools" },
            To: [...recipients].map((email) => ({ Email: email })),
            Subject: `Aqua Clear Pools Monthly Summary — ${f.name} (${period.title})`,
            HTMLPart: html,
            TextPart: text,
          }],
        }),
      });

      if (!mjRes.ok) {
        const detail = JSON.stringify(await mjRes.json().catch(() => ({}))).slice(0, 500);
        await supabase.from("commercial_monthly_report_sends").insert({
          facility_id: f.id, organization_id: orgId, period_key: period.key,
          recipients: [...recipients], status: "failed", error_detail: detail,
          triggered_by: manual ? "manual" : "cron",
        });
        results.push({ facility: f.name, status: "failed", recipients: recipients.size, detail });
        continue;
      }

      await supabase.from("commercial_monthly_report_sends").insert({
        facility_id: f.id, organization_id: orgId, period_key: period.key,
        recipients: [...recipients], status: "sent",
        triggered_by: manual ? "manual" : "cron",
      });
      results.push({ facility: f.name, status: "sent", recipients: recipients.size });
    }

    return json({ ok: true, period: period.key, results });
  } catch (err) {
    console.error("send-monthly-executive-summary error:", err);
    return json({ ok: false, error: (err as Error).message }, 500);
  }
};

serve(handler);
