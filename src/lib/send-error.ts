/**
 * Extracts the most specific provider error message available from a
 * supabase.functions.invoke() result (Telnyx / Mailjet edge functions).
 */
export async function extractSendError(error: any, data: any): Promise<string> {
  // 1. Structured error returned in the function's JSON body
  if (data && typeof data === 'object') {
    const parts = [data.error, data.errorTitle, data.errorDetail].filter(
      (p: unknown, i: number, arr: unknown[]) => p && arr.indexOf(p) === i
    );
    if (parts.length) {
      const code = data.errorCode ? `[${data.errorCode}] ` : '';
      return `${code}${parts.join(' — ')}${formatDiagnostics(data.diagnostics)}`;
    }
  }


  // 2. Non-2xx response: body lives on error.context (a Response)
  const ctx = error?.context;
  if (ctx && typeof ctx.text === 'function') {
    try {
      const raw = await ctx.text();
      try {
        const body = JSON.parse(raw);
        const code = body.errorCode ? `[${body.errorCode}] ` : '';
        const msg =
          [body.error, body.errorTitle, body.errorDetail, body.message]
            .filter(Boolean)
            .join(' — ') || raw;
        return `${code}${msg}`.trim();
      } catch {
        if (raw) return raw.slice(0, 300);
      }
    } catch {
      /* ignore */
    }
  }

  const status = ctx?.status ? ` (HTTP ${ctx.status})` : '';
  return `${error?.message || 'Unknown error'}${status}`;
}
