import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const nullableString = { type: ["string", "null"] };
const nullableNumber = { type: ["number", "null"] };

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["vendor", "invoice_number", "invoice_date", "subtotal", "tax", "total", "line_items"],
  properties: {
    vendor: nullableString,
    invoice_number: nullableString,
    invoice_date: { ...nullableString, description: "ISO date YYYY-MM-DD" },
    subtotal: nullableNumber,
    tax: nullableNumber,
    total: nullableNumber,
    line_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "quantity",
          "sku",
          "description",
          "unit_price",
          "line_total",
          "package_size",
          "package_unit",
        ],
        properties: {
          quantity: { ...nullableNumber, description: "Number of packages/containers purchased" },
          sku: nullableString,
          description: nullableString,
          unit_price: nullableNumber,
          line_total: nullableNumber,
          package_size: {
            ...nullableNumber,
            description: "Size of one container, e.g. 100 for a 100 lb bucket or 4 for a 4 gal case",
          },
          package_unit: { ...nullableString, description: "lbs, gal, oz, qt, or null" },
        },
      },
    },
  },
} as const;

const SYSTEM = `You extract structured data from pool-supply vendor receipts and invoices.
Rules:
- Read every line item, not just the first.
- quantity is the number of containers/packages billed on that line, never the weight or volume.
- Package information inside a description such as "100#", "100 lb", "4x1 gal", "16 per pallet" belongs in package_size/package_unit, never in quantity.
- unit_price is the price of one container; line_total is the extended amount for the line.
- Use numbers without currency symbols or commas. Use null when a value is not printed on the document.
- Never invent values.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI is not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { dataUrl, mimeType, filename } = await req.json();
    if (!dataUrl || typeof dataUrl !== "string") {
      return new Response(JSON.stringify({ error: "No file supplied." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isPdf = (mimeType || "").includes("pdf");
    const mediaPart = isPdf
      ? { type: "input_file", filename: filename || "invoice.pdf", file_data: dataUrl }
      : { type: "input_image", image_url: dataUrl };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        instructions: SYSTEM,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Extract the vendor, invoice details and all line items from this receipt/invoice." },
              mediaPart,
            ],
          },
        ],
        reasoning: { effort: "low", summary: "auto" },
        text: { format: { type: "json_schema", name: "receipt", strict: true, schema } },
      }),
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      let message = "Could not read the receipt. Try a clearer photo.";
      if (res.status === 402) message = "AI credits are exhausted. Add credits to keep scanning receipts.";
      if (res.status === 429) message = "Too many requests right now — wait a moment and try again.";
      console.error("gateway error", res.status, detail.slice(0, 500));
      return new Response(JSON.stringify({ error: message }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read the SSE stream and accumulate the output text.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
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
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
            text += evt.delta;
          } else if (evt.type === "response.completed" && !text) {
            text = evt.response?.output_text ?? "";
          }
        } catch (_) {
          // ignore keep-alive / partial frames
        }
      }
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error("unparsable model output", text.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Could not read the receipt. Try a clearer photo or enter it manually." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("parse-receipt failed", err);
    return new Response(JSON.stringify({ error: "Receipt scanning failed. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
