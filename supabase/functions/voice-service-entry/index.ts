// Voice-assisted service entry: transcribes a short technician recording and
// interprets it into the existing FieldService form fields. Never saves anything.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MAX_BYTES = 12 * 1024 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function gatewayMessage(status: number, fallback: string) {
  if (status === 402) return "AI credits are exhausted. Add credits to keep using voice entry.";
  if (status === 403) return "AI access is currently blocked for this workspace.";
  if (status === 429) return "Too many voice requests right now — wait a moment and try again.";
  return fallback;
}

async function readSse(res: Response, onEvent: (evt: any) => void) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try { onEvent(JSON.parse(payload)); } catch { /* partial frame */ }
    }
  }
}

const str = { type: ["string", "null"] };
const flag = { type: ["string", "null"], description: "Why this value needs confirmation, or null if clear" };

function buildSchema(ctx: any) {
  const chemIds: string[] = (ctx.chemicals ?? []).map((c: any) => c.id);
  if (!chemIds.includes("other")) chemIds.push("other");
  return {
    type: "object",
    additionalProperties: false,
    required: ["readings", "chemicals", "checklist", "services", "actions", "equipment", "equipment_notes", "notes", "repair_notes", "follow_up"],
    properties: {
      readings: {
        type: "array",
        items: {
          type: "object", additionalProperties: false,
          required: ["field", "value", "heard", "flag"],
          properties: {
            field: { type: "string", enum: ["chlorine", "ph", "alkalinity", "cya", "calcium", "salt", ...(ctx.traceTests ? ["phosphates", "iron", "copper"] : [])] },
            value: { type: ["number", "null"] },
            heard: { type: "string", description: "The words spoken for this reading" },
            flag,
          },
        },
      },
      chemicals: {
        type: "array",
        items: {
          type: "object", additionalProperties: false,
          required: ["chemical_id", "other_name", "amount", "unit", "heard", "flag"],
          properties: {
            chemical_id: { type: "string", enum: chemIds },
            other_name: str,
            amount: { type: ["number", "null"] },
            unit: { type: ["string", "null"], enum: ["lbs", "oz", "gal", "qt", null] },
            heard: { type: "string" },
            flag,
          },
        },
      },
      checklist: { type: "array", items: { type: "string", enum: ctx.checklist ?? [] } },
      services: { type: "array", items: { type: "string", enum: ctx.services ?? [] } },
      actions: { type: "array", items: { type: "string", enum: ["cleaned_robot", "robot_plugged_in", "robot_in_water", "salt_cell_cleaned"] } },
      equipment: {
        type: "array",
        items: {
          type: "object", additionalProperties: false,
          required: ["id", "status", "note"],
          properties: {
            id: { type: "string", enum: ctx.equipment ?? [] },
            status: { type: "string", enum: ["ok", "issue"] },
            note: str,
          },
        },
      },
      equipment_notes: { ...str, description: "Equipment observations incl. filter pressure/PSI and water temperature" },
      notes: { ...str, description: "General visit notes" },
      repair_notes: str,
      follow_up: { ...str, description: "Follow-up needs the tech mentioned" },
    },
  };
}

function instructions(ctx: any) {
  const chems = (ctx.chemicals ?? []).map((c: any) => `${c.id} = ${c.label} (units: ${c.units.join("/")})`).join("\n");
  return `You convert a pool technician's spoken visit notes into form fields. Only include what was actually said.
Reading fields and normal ranges: chlorine = free chlorine ppm (1-3, "FC"/"chlorine"); ph (7.2-7.6); alkalinity ppm (80-120, "alk"/"TA"); cya ppm (30-50, "stabilizer"/"conditioner"); calcium = calcium hardness ppm; salt ppm (2700-3400).${ctx.traceTests ? `
phosphates = phosphate as PO4 in ppb (usually 0-1000). If spoken in ppm, value = ppm x 1000 and flag "Heard X ppm — converted to Y ppb". iron = iron ppm, copper = copper ppm (usually 0-0.5). If only "metals" is said without iron or copper, do not guess — put it in notes.` : ""}
Spoken numbers: "seven six" for pH = 7.6; "thirty-two fifty" = 3250; "three" = 3.
Ambiguity rules — NEVER silently correct. If a value is implausible or ambiguous, put your best interpretation in value AND explain in flag. Examples: "pH 76" -> value 7.6, flag "Heard 76 — did you mean 7.6?"; "salt 32" -> value 3200, flag "Heard 32 — did you mean 3200 ppm?". If a value cannot be determined, value null with a flag.
Chemicals (choose chemical_id from this catalog; brand/slang like "shock", "cal hypo", "acid", "bicarb", "tabs" map to the closest one; otherwise "other" with other_name):
${chems}
Amounts: "half a gallon" = 0.5 gal. Use only the units listed for that chemical. If the unit is not measurable in those units (e.g. "three tabs"), set amount to the count, unit null, and flag asking for the weight.
Checklist ids: ${(ctx.checklist ?? []).join(", ")}. Service names must come from the provided list.
Actions: cleaned_robot, robot_plugged_in, robot_in_water, salt_cell_cleaned.
Equipment ids: ${(ctx.equipment ?? []).join(", ")} — status "issue" only if a problem was described.
Filter pressure/PSI and water temperature go into equipment_notes (there is no dedicated field).
Keep notes short and in the technician's words. Use null / empty arrays when nothing was said.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI is not configured." }, 500);

    const form = await req.formData();
    const file = form.get("file");
    const ctx = JSON.parse(String(form.get("context") ?? "{}"));
    if (!(file instanceof File) || !file.size) return json({ error: "No recording received. Please try again." }, 400);
    if (file.size > MAX_BYTES) return json({ error: "Recording is too long. Keep it under 3 minutes." }, 413);

    // 1) Transcription (billed request #1)
    const tForm = new FormData();
    tForm.append("model", "google/gemini-3.5-transcribe");
    tForm.append("file", new File([file], "recording.wav", { type: "audio/wav" }));
    tForm.append("response_format", "json");
    tForm.append("stream", "true");
    tForm.append("language", "en");
    const tRes = await fetch(`${GATEWAY}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "X-Lovable-AIG-SDK": "fetch" },
      body: tForm,
    });
    if (!tRes.ok || !tRes.body) {
      const detail = await tRes.text().catch(() => "");
      console.error("transcription error", tRes.status, detail.slice(0, 400));
      return json({ error: gatewayMessage(tRes.status, "Couldn't hear that clearly. Please try again.") }, tRes.status);
    }
    let transcript = "";
    let finalText = "";
    await readSse(tRes, (evt) => {
      if (evt.type === "transcript.text.delta" && typeof evt.delta === "string") transcript += evt.delta;
      if (evt.type === "transcript.text.done" && typeof evt.text === "string") finalText = evt.text;
    });
    transcript = (finalText || transcript).trim();
    if (!transcript) return json({ error: "No speech detected. Hold the phone closer and try again." }, 422);

    // 2) Interpretation (billed request #2)
    const iRes = await fetch(`${GATEWAY}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        instructions: instructions(ctx),
        input: [{ role: "user", content: [{ type: "input_text", text: `Technician said: """${transcript}"""` }] }],
        reasoning: { effort: "low", summary: "auto" },
        text: { format: { type: "json_schema", name: "service_entry", strict: true, schema: buildSchema(ctx) } },
      }),
    });
    if (!iRes.ok || !iRes.body) {
      const detail = await iRes.text().catch(() => "");
      console.error("interpretation error", iRes.status, detail.slice(0, 400));
      return json({ transcript, error: gatewayMessage(iRes.status, "Couldn't interpret the recording. You can still type the values.") }, iRes.status);
    }
    let text = "";
    await readSse(iRes, (evt) => {
      if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") text += evt.delta;
      else if (evt.type === "response.completed" && !text) text = evt.response?.output_text ?? "";
    });
    let result: unknown;
    try { result = JSON.parse(text); } catch {
      console.error("unparsable", text.slice(0, 400));
      return json({ transcript, error: "Couldn't interpret the recording. You can still type the values." }, 422);
    }
    return json({ transcript, result });
  } catch (err) {
    console.error("voice-service-entry failed", err);
    return json({ error: "Voice entry failed. Please try again." }, 500);
  }
});
