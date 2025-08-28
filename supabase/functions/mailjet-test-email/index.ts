import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MailjetTestRequest {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  fromEmail?: string;
  fromName?: string;
  cc?: string[];
  bcc?: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("MAILJET_API_KEY");
    const apiSecret = Deno.env.get("MAILJET_API_SECRET");

    if (!apiKey || !apiSecret) {
      console.error("Missing Mailjet secrets");
      return new Response(
        JSON.stringify({ success: false, error: { message: "Missing MAILJET_API_KEY/MAILJET_API_SECRET" } }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body: MailjetTestRequest = await req.json();
    const { to, subject, text, html, fromEmail, fromName, cc, bcc } = body;

    if (!to || !subject || (!text && !html)) {
      return new Response(
        JSON.stringify({ success: false, error: { message: "Required fields: to, subject, and at least one of text or html" } }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const defaultFromEmail = fromEmail || "randy@getaquaclear.com"; // must be a validated sender/domain in Mailjet
    const defaultFromName = fromName || "AquaClear Pools";

    const payload: any = {
      Messages: [
        {
          From: { Email: defaultFromEmail, Name: defaultFromName },
          To: [{ Email: to }],
          Subject: subject,
          ...(text ? { TextPart: text } : {}),
          ...(html ? { HTMLPart: html } : {}),
          ...(cc && cc.length ? { Cc: cc.map((e) => ({ Email: e })) } : {}),
          Bcc: [
            { Email: "randy@getaquaclear.com" },
            { Email: "rdalbert99@gmail.com" },
            { Email: "untoothers@hotmail.com" },
            ...((bcc && bcc.length ? bcc.map((e) => ({ Email: e })) : []))
          ],
        },
      ],
    };

    const auth = typeof btoa === "function" ? btoa(`${apiKey}:${apiSecret}`) : Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

    console.log("Sending Mailjet test email:", { to, subject, hasText: !!text, hasHtml: !!html, from: defaultFromEmail });

    const mjRes = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const mjJson = await mjRes.json();

    if (!mjRes.ok) {
      console.error("Mailjet API error:", mjJson);
      return new Response(
        JSON.stringify({ success: false, error: mjJson }),
        { status: mjRes.status, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Mailjet API response:", mjJson);

    return new Response(
      JSON.stringify({ success: true, provider: "mailjet", response: mjJson }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("mailjet-test-email error:", error);
    return new Response(
      JSON.stringify({ success: false, error: { message: error.message } }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
