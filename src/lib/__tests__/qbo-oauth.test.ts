import { describe, it, expect } from 'vitest';
import {
  FALLBACK_ENDPOINTS, QboError, accessNeedsRefresh, expectJson, friendlyMessage, needsReconnect,
  parseDiscovery, parseIntuitError, refreshExpired, requestWithRetry, sanitize,
} from '../../../supabase/functions/_shared/qbo-oauth';

const reply = (status: number, body = '', headers: Record<string, string> = {}) => ({
  status, text: async () => body, headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
});
const seq = (...rs: any[]) => { let i = 0; const calls: string[] = []; return { calls, fn: async (u: string) => { calls.push(u); const r = rs[Math.min(i++, rs.length - 1)]; if (r instanceof Error) throw r; return r; } }; };
const noSleep = { sleep: async () => {}, random: () => 0 };

describe('Intuit request retries', () => {
  it('retries a 500 then succeeds, keeping intuit_tid', async () => {
    const s = seq(reply(500, '', { intuit_tid: 'a' }), reply(200, '{"ok":1}', { intuit_tid: 'b' }));
    const r = await requestWithRetry(s.fn as any, 'u', {}, { retry: true, ...noSleep });
    expect(r).toMatchObject({ status: 200, intuitTid: 'b', attempts: 2 });
  });
  it('stops after 2 retries on repeated 429', async () => {
    const s = seq(reply(429, '{}', { 'retry-after': '1' }));
    const r = await requestWithRetry(s.fn as any, 'u', {}, { retry: true, ...noSleep });
    expect(r.status).toBe(429); expect(s.calls.length).toBe(3);
  });
  it('never retries 400, 401 or 403', async () => {
    for (const st of [400, 401, 403]) {
      const s = seq(reply(st, '{}'));
      await requestWithRetry(s.fn as any, 'u', {}, { retry: true, ...noSleep });
      expect(s.calls.length).toBe(1);
    }
  });
  it('does not retry at all when retry=false (one-time code exchange)', async () => {
    const s = seq(reply(503, ''));
    await requestWithRetry(s.fn as any, 'u', {}, { retry: false, ...noSleep });
    expect(s.calls.length).toBe(1);
  });
  it('turns repeated network failures into a network error', async () => {
    const s = seq(new Error('boom'));
    await expect(requestWithRetry(s.fn as any, 'u', {}, { retry: true, ...noSleep })).rejects.toMatchObject({ kind: 'network', attempts: 3 });
  });
});

describe('Intuit error parsing', () => {
  const fault = JSON.stringify({ Fault: { Error: [{ Message: 'Bad thing', Detail: 'more', code: '6000' }] } });
  it.each([
    [400, 'bad_request'], [401, 'unauthorized'], [403, 'forbidden'], [429, 'rate_limited'], [500, 'server'],
  ])('maps HTTP %i to %s and keeps intuit_tid', (status, kind) => {
    const e = parseIntuitError(status, fault, 'tid-1');
    expect(e.kind).toBe(kind); expect(e.intuitTid).toBe('tid-1'); expect(e.code).toBe('6000');
    expect(friendlyMessage(e)).toContain('tid-1');
  });
  it('detects invalid_grant as needing reconnect', () => {
    const e = parseIntuitError(400, '{"error":"invalid_grant"}', null);
    expect(e.kind).toBe('invalid_grant'); expect(needsReconnect(e)).toBe(true);
  });
  it('rejects non-JSON, empty and Fault-in-200 replies as errors', () => {
    expect(() => expectJson({ status: 200, text: '<html>', intuitTid: null, attempts: 1 })).toThrow(QboError);
    expect(() => expectJson({ status: 200, text: '', intuitTid: null, attempts: 1 })).toThrow(/could not be read/);
    expect(() => expectJson({ status: 200, text: fault, intuitTid: null, attempts: 1 })).toThrow(QboError);
    expect(expectJson({ status: 200, text: '{"a":1}', intuitTid: null, attempts: 1 })).toEqual({ a: 1 });
  });
});

describe('Token expiry', () => {
  const now = Date.parse('2026-10-23T00:00:00Z');
  it('refreshes access token within 2 minutes of expiry', () => {
    expect(accessNeedsRefresh('2026-10-23T00:01:00Z', now)).toBe(true);
    expect(accessNeedsRefresh('2026-10-23T00:30:00Z', now)).toBe(false);
  });
  it('treats a past refresh-token expiry as expired', () => {
    expect(refreshExpired('2026-10-22T00:00:00Z', now)).toBe(true);
    expect(refreshExpired('2026-12-01T00:00:00Z', now)).toBe(false);
    expect(refreshExpired(null, now)).toBe(false);
  });
});

describe('Discovery document', () => {
  it('accepts Intuit https endpoints', () => {
    expect(parseDiscovery({ ...FALLBACK_ENDPOINTS })).toMatchObject(FALLBACK_ENDPOINTS);
  });
  it('rejects missing or non-Intuit endpoints', () => {
    expect(parseDiscovery({ ...FALLBACK_ENDPOINTS, token_endpoint: 'https://evil.example.com/t' })).toBeNull();
    expect(parseDiscovery({ authorization_endpoint: FALLBACK_ENDPOINTS.authorization_endpoint })).toBeNull();
    expect(parseDiscovery(null)).toBeNull();
  });
});

describe('Log sanitizing', () => {
  it('removes tokens, secrets, codes and emails', () => {
    const raw = 'Bearer abc.def.ghi refresh_token=RT123 "client_secret":"shh" code=XYZ eyJhbGciOiJIUzI1.eyJzdWIiOiIx.sig mail randy@getaquaclear.com AB11234567890123456789012345';
    const out = sanitize(raw);
    for (const leak of ['abc.def.ghi', 'RT123', 'shh', 'XYZ', 'eyJhbGciOiJIUzI1', 'randy@', 'AB11234567890123456789012345']) expect(out).not.toContain(leak);
  });
  it('caps length', () => { expect(sanitize('x'.repeat(2000)).length).toBeLessThanOrEqual(501); });
});
