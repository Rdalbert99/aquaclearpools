// Pure helpers for every Intuit call: discovery, bounded retries, error parsing,
// intuit_tid capture and log sanitizing. No Deno/Node APIs so vitest can import it.

export type QboEnv = 'sandbox' | 'production';

export const DISCOVERY_URLS: Record<QboEnv, string> = {
  sandbox: 'https://developer.intuit.com/.well-known/openid_sandbox_configuration',
  production: 'https://developer.intuit.com/.well-known/openid_configuration',
};

export interface OAuthEndpoints {
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint: string;
  userinfo_endpoint?: string;
}

/** Used only when the discovery document can't be fetched and nothing is cached. */
export const FALLBACK_ENDPOINTS: OAuthEndpoints = {
  authorization_endpoint: 'https://appcenter.intuit.com/connect/oauth2',
  token_endpoint: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
  revocation_endpoint: 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke',
};

const isIntuitHttps = (u: unknown) => {
  try {
    const url = new URL(String(u));
    return url.protocol === 'https:' && /(^|\.)intuit\.com$/.test(url.hostname);
  } catch { return false; }
};

/** Accepts a discovery document only if all required endpoints are https Intuit addresses. */
export function parseDiscovery(doc: any): OAuthEndpoints | null {
  if (!doc || typeof doc !== 'object') return null;
  const { authorization_endpoint, token_endpoint, revocation_endpoint, userinfo_endpoint } = doc;
  if (![authorization_endpoint, token_endpoint, revocation_endpoint].every(isIntuitHttps)) return null;
  return { authorization_endpoint, token_endpoint, revocation_endpoint, ...(isIntuitHttps(userinfo_endpoint) ? { userinfo_endpoint } : {}) };
}

export type QboErrorKind =
  | 'invalid_grant' | 'unauthorized' | 'forbidden' | 'rate_limited'
  | 'server' | 'bad_request' | 'malformed' | 'network' | 'not_connected';

export class QboError extends Error {
  constructor(
    public kind: QboErrorKind,
    message: string,
    public status: number | null = null,
    public code: string | null = null,
    public intuitTid: string | null = null,
    public attempts = 1,
  ) { super(message); }
}

/** Removes anything that could be a credential or personal detail; caps length. */
export function sanitize(text: unknown, max = 500): string {
  let s = String(text ?? '');
  s = s.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]');
  s = s.replace(/("?(access_token|refresh_token|id_token|client_secret|code|authorization)"?\s*[:=]\s*"?)[^"&,\s}]+/gi, '$1[redacted]');
  s = s.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-jwt]');
  s = s.replace(/\b[A-Z]{2}\d{3}[A-Za-z0-9]{20,}\b/g, '[redacted-token]');
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]');
  return s.length > max ? s.slice(0, max) + '…' : s;
}

export function safeJson(text: string): { ok: true; value: any } | { ok: false } {
  if (!text || !text.trim()) return { ok: false };
  try { return { ok: true, value: JSON.parse(text) }; } catch { return { ok: false }; }
}

/** Turns an Intuit error reply (OAuth or accounting Fault format) into a QboError. */
export function parseIntuitError(status: number, text: string, intuitTid: string | null, attempts = 1): QboError {
  const j = safeJson(text);
  let code: string | null = null;
  let detail = '';
  if (j.ok) {
    const v = j.value;
    if (typeof v?.error === 'string') { code = v.error; detail = v.error_description ?? ''; }
    const f = v?.Fault?.Error?.[0] ?? v?.fault?.error?.[0];
    if (f) { code = String(f.code ?? code ?? ''); detail = [f.Message ?? f.message, f.Detail ?? f.detail].filter(Boolean).join(' — '); }
  }
  const msg = sanitize(detail || (j.ok ? '' : text) || `HTTP ${status}`);
  let kind: QboErrorKind;
  if (code === 'invalid_grant') kind = 'invalid_grant';
  else if (status === 401) kind = 'unauthorized';
  else if (status === 403) kind = 'forbidden';
  else if (status === 429) kind = 'rate_limited';
  else if (status >= 500) kind = 'server';
  else kind = 'bad_request';
  return new QboError(kind, msg, status, code, intuitTid, attempts);
}

export const isTransient = (status: number) => status === 429 || status >= 500;

export interface HttpResult { status: number; text: string; intuitTid: string | null; attempts: number }

type FetchFn = (url: string, init?: any) => Promise<{ status: number; headers: { get(n: string): string | null }; text(): Promise<string> }>;

/**
 * Sends a request and retries ONLY network errors, 429 and 5xx, up to maxRetries.
 * Callers must pass retry=false for anything that isn't safe to repeat
 * (e.g. the one-time authorization-code exchange or any future write).
 */
export async function requestWithRetry(
  fetchFn: FetchFn, url: string, init: any,
  opts: { retry: boolean; maxRetries?: number; sleep?: (ms: number) => Promise<void>; random?: () => number } ,
): Promise<HttpResult> {
  const max = opts.retry ? (opts.maxRetries ?? 2) : 0;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const random = opts.random ?? Math.random;
  let attempt = 0;
  let lastTid: string | null = null;
  while (true) {
    attempt++;
    try {
      const res = await fetchFn(url, init);
      const text = await res.text();
      lastTid = res.headers.get('intuit_tid');
      if (isTransient(res.status) && attempt <= max) {
        const ra = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 10_000) : 500 * 2 ** (attempt - 1) + Math.floor(random() * 250);
        await sleep(wait);
        continue;
      }
      return { status: res.status, text, intuitTid: lastTid, attempts: attempt };
    } catch (e) {
      if (attempt <= max) { await sleep(500 * 2 ** (attempt - 1) + Math.floor(random() * 250)); continue; }
      throw new QboError('network', sanitize((e as Error)?.message ?? 'Network error'), null, null, lastTid, attempt);
    }
  }
}

/** Parses a successful reply; throws a 'malformed' error for non-JSON bodies or error statuses otherwise. */
export function expectJson(r: HttpResult): any {
  if (r.status < 200 || r.status >= 300) throw parseIntuitError(r.status, r.text, r.intuitTid, r.attempts);
  const j = safeJson(r.text);
  if (!j.ok) throw new QboError('malformed', 'QuickBooks sent a reply that could not be read.', r.status, null, r.intuitTid, r.attempts);
  if (j.value?.Fault) throw parseIntuitError(400, r.text, r.intuitTid, r.attempts);
  return j.value;
}

export function refreshExpired(refreshExpiresAt: string | null | undefined, now = Date.now()): boolean {
  return !!refreshExpiresAt && new Date(refreshExpiresAt).getTime() <= now;
}

export function accessNeedsRefresh(accessExpiresAt: string, now = Date.now()): boolean {
  return new Date(accessExpiresAt).getTime() - now <= 120_000;
}

/** Errors that mean the saved connection is unusable and the admin must reconnect. */
export const needsReconnect = (e: QboError) => e.kind === 'invalid_grant' || e.kind === 'not_connected';

export function friendlyMessage(e: QboError): string {
  const ref = e.intuitTid ? ` (Intuit ref ${e.intuitTid})` : '';
  switch (e.kind) {
    case 'invalid_grant':
    case 'not_connected': return `QuickBooks access has expired or was revoked. Tap "Reconnect QuickBooks".${ref}`;
    case 'unauthorized': return `QuickBooks rejected the sign-in. Try again; if it repeats, reconnect QuickBooks.${ref}`;
    case 'forbidden': return `This QuickBooks user isn't allowed to view that data.${ref}`;
    case 'rate_limited': return `QuickBooks is busy (too many requests). Wait a minute and try again.${ref}`;
    case 'server': return `QuickBooks is having problems right now. Try again later.${ref}`;
    case 'malformed': return `QuickBooks sent a reply that could not be read. Try again.${ref}`;
    case 'network': return 'Could not reach QuickBooks. Check the connection and try again.';
    default: return `QuickBooks refused the request: ${e.message}${ref}`;
  }
}
