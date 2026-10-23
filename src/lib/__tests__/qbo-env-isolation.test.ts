import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { API_BASES, accountingUrl, assertSameEnv, resolveCredentials, resolveEnv } from '../../../supabase/functions/_shared/qbo-oauth';

const env = (o: Record<string, string>) => (n: string) => o[n];

describe('QuickBooks sandbox/production isolation', () => {
  it('defaults to sandbox unless production is explicit', () => {
    expect(resolveEnv(undefined)).toBe('sandbox');
    expect(resolveEnv('prod')).toBe('sandbox');
    expect(resolveEnv(' Production ')).toBe('production');
  });
  it('production fails closed without production keys, ignoring sandbox/legacy keys', () => {
    expect(resolveCredentials('production', env({ QBO_CLIENT_ID: 'a', QBO_CLIENT_SECRET: 'b', QBO_SANDBOX_CLIENT_ID: 'c', QBO_SANDBOX_CLIENT_SECRET: 'd' }))).toBeNull();
    expect(resolveCredentials('production', env({ QBO_PRODUCTION_CLIENT_ID: 'p' }))).toBeNull();
    expect(resolveCredentials('production', env({ QBO_PRODUCTION_CLIENT_ID: 'p', QBO_PRODUCTION_CLIENT_SECRET: 'q' }))).toEqual({ clientId: 'p', clientSecret: 'q' });
  });
  it('sandbox prefers sandbox keys, falls back to legacy keys, never uses production keys', () => {
    expect(resolveCredentials('sandbox', env({ QBO_SANDBOX_CLIENT_ID: 's', QBO_SANDBOX_CLIENT_SECRET: 't', QBO_CLIENT_ID: 'a', QBO_CLIENT_SECRET: 'b' }))).toEqual({ clientId: 's', clientSecret: 't' });
    expect(resolveCredentials('sandbox', env({ QBO_CLIENT_ID: 'a', QBO_CLIENT_SECRET: 'b' }))).toEqual({ clientId: 'a', clientSecret: 'b' });
    expect(resolveCredentials('sandbox', env({ QBO_PRODUCTION_CLIENT_ID: 'p', QBO_PRODUCTION_CLIENT_SECRET: 'q' }))).toBeNull();
  });
  it('a sandbox connection is refused in production and vice versa', () => {
    expect(() => assertSameEnv({ environment: 'sandbox' }, 'production')).toThrow();
    expect(() => assertSameEnv({ environment: 'production' }, 'sandbox')).toThrow();
    expect(() => assertSameEnv(null, 'sandbox')).toThrow();
    expect(() => assertSameEnv({ environment: 'sandbox' }, 'sandbox')).not.toThrow();
  });
  it('accounting URLs use the active environment host only', () => {
    expect(accountingUrl('sandbox', '9341458549860760', '/companyinfo/1')).toBe(`${API_BASES.sandbox}/v3/company/9341458549860760/companyinfo/1`);
    expect(accountingUrl('production', '123', '/query?x=1').startsWith('https://quickbooks.api.intuit.com/')).toBe(true);
    expect(() => accountingUrl('sandbox', '12a', '/x')).toThrow();
  });
});

describe('qbo-connect stays read-only and environment-scoped', () => {
  const src = readFileSync('supabase/functions/qbo-connect/index.ts', 'utf8');
  it('accounting API calls are GET only', () => {
    expect(src).toMatch(/accountingUrl\(ENV, c\.realm_id, path\), \{\s*method: "GET"/);
    expect(src).not.toMatch(/API_BASE\b/);
  });
  it('every qbo_connections query is filtered by environment', () => {
    const calls = src.split('from("qbo_connections")').slice(1);
    expect(calls.length).toBeGreaterThan(5);
    for (const c of calls) {
      const stmt = c.slice(0, c.indexOf(';'));
      if (/\.eq\("realm_id", realmId\)\.maybeSingle/.test(stmt)) continue; // cross-env clash check
      if (/\.upsert\(/.test(stmt)) continue; // row carries environment: ENV
      expect(stmt).toContain('.eq("environment", ENV)');
    }
  });
  it('callback refuses a company already saved under the other environment', () => {
    expect(src).toContain('environment_mismatch');
  });
});
