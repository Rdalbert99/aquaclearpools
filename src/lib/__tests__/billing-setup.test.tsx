import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { discoverProvider, readCustomer, compareIdentity, customerFingerprint, searchCustomers } from '../../../docs/billing-readiness/server/setup';
import { createBillingApplication } from '../../../docs/billing-readiness/server/production';
import { batchSummary, enrollmentLabel, announcementAudience, type BatchRow } from '../billing-batch';
import { readinessRow, OWNER_IDS } from '../billing-readiness';
import { routeGate } from '../route-gate';
const mock = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/lib/billing-transport', () => ({ billingInvoke: mock.invoke }));
vi.mock('@/components/ui/checkbox', () => ({ Checkbox: ({ onCheckedChange, checked, ...p }: { onCheckedChange?: (v: boolean) => void; checked?: boolean } & Record<string, unknown>) => <input type="checkbox" {...p} checked={!!checked} onClick={() => onCheckedChange?.(!checked)} readOnly /> }));
import { ProviderSetup, CustomerMapping } from '@/components/billing/BillingSetup';

const REALM = '9341452568721903';
const item = { Id: '1010000001', Name: 'Pool Maintenance', Active: true, Type: 'Service', Taxable: false, IncomeAccountRef: { value: '79' }, SyncToken: '3' };
const qbo = (over: Record<string, any> = {}) => {
  const calls: string[] = [];
  const get = async (path: string) => { calls.push(path);
    if (path.startsWith('/item/')) return { Item: over.item ?? item };
    if (path.startsWith('/account/')) return { Account: over.account ?? { Id: '79', Name: 'Services', Active: true, AccountType: 'Income', SyncToken: '1' } };
    if (path.startsWith('/companyinfo/')) return { CompanyInfo: over.company ?? { Id: REALM, CompanyName: 'Aqua Clear Pools', Country: 'US' } };
    if (path.startsWith('/customer/')) return { Customer: over.customer ?? { Id: '58', DisplayName: 'Robert Boswell', Active: true, PrimaryEmailAddr: { Address: 'RB@example.test' }, PrimaryPhone: { FreeFormNumber: '(601) 555-0100' }, SyncToken: '0' } };
    if (path.startsWith('/query')) return { QueryResponse: { Customer: [{ Id: '58', DisplayName: 'Robert Boswell' }] } };
    throw new Error('unexpected'); };
  return { get, calls };
};
const app = { id: 'c1', customer: 'Robert Boswell', status: 'Active', contact_email: 'rb@example.test', contact_phone: '6015550100', address: null };

describe('provider setup discovery (GET-only, derived refs)', () => {
  it('derives the income account from the live Item, never input', async () => {
    const q = qbo(); const e = await discoverProvider(q.get, REALM, '1010000001');
    expect(e.item.incomeAccountId).toBe('79'); expect(e.account.type).toBe('Income'); expect(e.taxSupported).toBe(true);
    expect(q.calls).toEqual(['/item/1010000001', '/account/79', `/companyinfo/${REALM}`]);
  });
  it('fails closed for taxable item, non-income account, non-US and wrong company', async () => {
    expect((await discoverProvider(qbo({ item: { ...item, Taxable: true } }).get, REALM, '1010000001')).taxSupported).toBe(false);
    expect((await discoverProvider(qbo({ account: { Id: '79', AccountType: 'Expense' } }).get, REALM, '1010000001')).taxSupported).toBe(false);
    expect((await discoverProvider(qbo({ company: { Id: REALM, Country: 'CA' } }).get, REALM, '1010000001')).taxSupported).toBe(false);
    await expect(discoverProvider(qbo({ company: { Id: '1', Country: 'US' } }).get, REALM, '1010000001')).rejects.toThrow('company_mismatch');
  });
  it('fingerprint changes when the live item changes (stale evidence detection)', async () => {
    const a = await discoverProvider(qbo().get, REALM, '1010000001');
    const b = await discoverProvider(qbo({ item: { ...item, SyncToken: '4', IncomeAccountRef: { value: '79' } } }).get, REALM, '1010000001');
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });
});

describe('customer identity evidence', () => {
  it('supported only with contact match and no conflicts; name alone never links', async () => {
    const qb = await readCustomer(qbo().get, '58');
    expect(compareIdentity(app, qb).supported).toBe(true);
    expect(compareIdentity({ ...app, contact_email: null, contact_phone: null }, qb).supported).toBe(false);
    expect(compareIdentity({ ...app, contact_phone: '6015559999' }, qb).blockers.join()).toContain('Conflicting phone');
    expect(compareIdentity(app, { ...qb, active: false }).blockers).toContain('QuickBooks customer inactive');
  });
  it('fingerprint binds app identity, QB record and realm', async () => {
    const qb = await readCustomer(qbo().get, '58');
    expect(customerFingerprint(REALM, app, qb)).not.toBe(customerFingerprint('1', app, qb));
    expect(customerFingerprint(REALM, app, qb)).not.toBe(customerFingerprint(REALM, { ...app, id: 'c2' }, qb));
  });
  it('search is bounded and quote-stripped', async () => {
    const q = qbo(); await searchCustomers(q.get, "O'Brien");
    expect(decodeURIComponent(q.calls[0])).toContain("like '%OBrien%' MAXRESULTS 10");
    await expect(searchCustomers(q.get, 'a')).rejects.toThrow('invalid_search');
  });
});

describe('server handler', () => {
  it('unauthorized setup requests fail before any QuickBooks call', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ message: 'bad' }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
    const h = createBillingApplication({ secret: n => n === 'SUPABASE_URL' ? 'https://synthetic.invalid' : 'k', fetch, scope: { businessId: 'b1', environment: 'production', realmId: REALM }, allowedOrigins: ['https://getaquaclear.com'] });
    for (const body of [{ action: 'discover_provider', itemId: '1010000001' }, { action: 'confirm_mapping', clientId: '00000000-0000-4000-8000-000000000001', customerId: '58', fingerprint: 'x', confirmed: true }]) {
      const r = await h.handler(new Request('https://x', { method: 'POST', headers: { Authorization: 'Bearer bad', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
      expect(r.status).toBe(401);
    }
    expect(fetch.mock.calls.every(c => String(c[0]).includes('/auth/v1/user'))).toBe(true);
  });
  it('CORS allows x-client-info only for approved origins; foreign origin rejected', async () => {
    const h = createBillingApplication({ secret: n => n === 'SUPABASE_URL' ? 'https://synthetic.invalid' : 'k', fetch: vi.fn(), scope: { businessId: 'b1', environment: 'production', realmId: REALM }, allowedOrigins: ['https://getaquaclear.com'] });
    const ok = await h.handler(new Request('https://x', { method: 'OPTIONS', headers: { origin: 'https://getaquaclear.com' } }));
    expect(ok.headers.get('Access-Control-Allow-Headers')).toContain('x-client-info');
    expect((await h.handler(new Request('https://x', { method: 'OPTIONS', headers: { origin: 'https://evil.test' } }))).status).toBe(403);
  });
  it('scope (business/realm) is host-fixed: request body cannot carry realm or business', async () => {
    const h = createBillingApplication({ secret: n => n === 'SUPABASE_URL' ? 'https://synthetic.invalid' : 'k', fetch: vi.fn(async () => new Response('{}', { status: 401 })), scope: { businessId: 'b1', environment: 'production', realmId: REALM }, allowedOrigins: [] });
    const r = await h.handler(new Request('https://x', { method: 'POST', body: JSON.stringify({ action: 'discover_provider', itemId: '1', realmId: '1', businessId: 'evil' }) }));
    expect(r.status).not.toBe(200);
  });
  it('setup reads are GET-only and the delta SQL grants no public/authenticated access', () => {
    const src = readFileSync('docs/billing-readiness/server/production.ts', 'utf8');
    expect(src).toMatch(/const qboGet=.*method:'GET'/);
    const sql = readFileSync('docs/billing-readiness/UNAPPLIED-delta-2026-10-25-setup.sql', 'utf8');
    expect(sql).not.toMatch(/GRANT [^;]* TO (anon|authenticated|PUBLIC)/i);
    expect(sql).toMatch(/mapping_conflict/);
  });
});

describe('readiness presentation', () => {
  const scope = { businessId: 'b1', environment: 'production' as const, realmId: REALM, smsConsent: true, smsOptedOut: false, consentRevision: '1' };
  const on = (m: string) => ({ enabled: true, firstServicePeriod: m, revision: 2, updatedBy: 'o', updatedAt: '2026-10-25T00:00:00Z' });
  const row = (client: Parameters<typeof readinessRow>[0], enrollment: ReturnType<typeof on>): BatchRow => ({ ...readinessRow(client, '2026-10', { ...scope, enrollment }), enrollment });
  it('shows saved enrollment ON/Nov while provider setup blocks the snapshot', () => {
    const r = row({ id: 'c1', customer: 'A', status: 'Active', service_rate: 200, contact_email: 'a@b.co' }, on('2026-11'));
    expect(r.snapshot).toBeNull(); expect(enrollmentLabel(r)).toEqual({ state: 'on', firstMonth: '2026-11' });
  });
  it('Laken hold, Peggy-like annual not due, December first month (Bill/Cindy) and inactive are excluded; audience never includes them', () => {
    const rows = [
      row({ id: OWNER_IDS.laken, customer: 'Laken Ramey', status: 'Active', service_rate: 125 }, on('2026-11')),
      row({ id: 'bill', customer: 'Bill', status: 'Active', service_rate: 150, contact_email: 'b@b.co' }, on('2026-12')),
      row({ id: 'x', customer: 'X', status: 'Inactive', service_rate: 150 }, on('2026-11')),
      readinessRow({ id: OWNER_IDS.peggy, customer: 'Peggy', status: 'Active', service_rate: 0 }, '2026-09', { ...scope, enrollment: on('2026-10') }),
    ];
    const b = batchSummary(rows);
    expect(b.excluded).toHaveLength(4); expect(b.eligible).toHaveLength(0); expect(announcementAudience(rows)).toEqual([]);
  });
});

describe('session rehydration gate', () => {
  it('restored session with unresolved profile stays loading, never redirects to login', () => {
    expect(routeGate({ loading: false, hasSession: true, hasUser: false })).toBe('loading');
    expect(routeGate({ loading: false, hasSession: false, hasUser: false })).toBe('login');
    expect(routeGate({ loading: false, hasSession: true, hasUser: true })).toBe('allowed');
  });
});

const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });
const byLabel = (t: ReactTestRenderer, l: string) => t.root.findAll(n => typeof n.type === 'string' && n.props['aria-label'] === l)[0];
const button = (t: ReactTestRenderer, text: string) => t.root.find(n => typeof n.type === 'string' && n.type === 'button' && [n.props.children].flat().join('').includes(text));
const evidence = { realmId: REALM, companyName: 'Aqua Clear Pools', country: 'US', taxSupported: true, blockers: [], fingerprint: 'fp1',
  item: { id: '1010000001', name: 'Pool Maintenance', active: true, type: 'Service', taxable: false, incomeAccountId: '79' }, account: { id: '79', name: 'Services', active: true, type: 'Income' } };

describe('rendered setup flows (mocked transport)', () => {
  beforeEach(() => mock.invoke.mockReset());
  it('provider: discover → confirm NON → save with derived account and fingerprint; refresh called', async () => {
    const saved = vi.fn();
    mock.invoke.mockImplementation(async (b: { action: string }) => b.action === 'discover_provider' ? { provider: evidence } : { verified: true });
    let t!: ReactTestRenderer; await act(async () => { t = create(<ProviderSetup onSaved={saved} />); });
    await act(async () => button(t, 'Look up').props.onClick()); await flush();
    expect(button(t, 'Verify & save').props.disabled).toBe(true); // tax confirmation required
    await act(async () => byLabel(t, 'Confirm non-taxable').props.onClick());
    await act(async () => button(t, 'Verify & save').props.onClick()); await flush();
    expect(mock.invoke.mock.calls[1][0]).toEqual({ action: 'verify_provider', itemId: '1010000001', fingerprint: 'fp1', taxReview: { confirmed: true, taxMode: 'non_taxable', taxCode: 'NON' } });
    expect(saved).toHaveBeenCalled();
  });
  it('provider: cancel makes no write; switching item discards a late response', async () => {
    let resolve!: (v: unknown) => void;
    mock.invoke.mockImplementation(() => new Promise(r => { resolve = r; }));
    let t!: ReactTestRenderer; await act(async () => { t = create(<ProviderSetup />); });
    await act(async () => { void button(t, 'Look up').props.onClick(); });
    await act(async () => byLabel(t, 'QuickBooks item ID').props.onChange({ target: { value: '22' } }));
    await act(async () => { resolve({ provider: evidence }); }); await flush();
    expect(t.root.findAll(n => n.props['data-testid'] === 'provider-evidence')).toHaveLength(0);
    expect(mock.invoke).toHaveBeenCalledTimes(1);
  });
  it('provider: taxable item cannot be confirmed or saved', async () => {
    mock.invoke.mockResolvedValue({ provider: { ...evidence, taxSupported: false, blockers: ['Item is marked taxable'] } });
    let t!: ReactTestRenderer; await act(async () => { t = create(<ProviderSetup />); });
    await act(async () => button(t, 'Look up').props.onClick()); await flush();
    expect(byLabel(t, 'Confirm non-taxable').props.disabled).toBe(true);
    expect(button(t, 'Verify & save').props.disabled).toBe(true);
  });
  const discovery = (over: Record<string, unknown> = {}) => ({ scope: { realmId: REALM, environment: 'production' }, app: { id: 'c1', customer: 'Robert Boswell', status: 'Active' }, fingerprint: 'cf1',
    customer: { id: '58', displayName: 'Robert Boswell', active: true, email: 'rb@example.test', phone: '', address: '' },
    comparison: { supported: true, blockers: [], evidence: [{ field: 'email', result: 'match' }] }, ...over });
  const mapping = async () => { let t!: ReactTestRenderer; await act(async () => { t = create(<CustomerMapping clients={[{ id: 'c1', customer: 'Robert Boswell' }, { id: 'c2', customer: 'Other' }]} />); });
    await act(async () => byLabel(t, 'App customer').props.onChange({ target: { value: 'c1' } }));
    await act(async () => byLabel(t, 'QuickBooks customer ID').props.onChange({ target: { value: '58' } })); return t; };
  it('mapping: lookup → confirm → save sends fingerprint; server rejection shows not saved', async () => {
    mock.invoke.mockImplementation(async (b: { action: string }) => { if (b.action === 'discover_customer') return discovery(); throw new Error('stale_identity_evidence'); });
    const t = await mapping();
    await act(async () => button(t, 'Look up').props.onClick()); await flush();
    await act(async () => byLabel(t, 'Confirm identity match').props.onClick());
    await act(async () => button(t, 'Save verified link').props.onClick()); await flush();
    expect(mock.invoke.mock.calls[1][0]).toEqual({ action: 'confirm_mapping', clientId: 'c1', customerId: '58', fingerprint: 'cf1', confirmed: true });
    expect(t.root.find(n => n.props.role === 'status').props.children).toBe('stale_identity_evidence');
  });
  it('mapping: inactive / conflicting identity cannot be confirmed', async () => {
    mock.invoke.mockResolvedValue(discovery({ comparison: { supported: false, blockers: ['QuickBooks customer inactive'], evidence: [] } }));
    const t = await mapping(); await act(async () => button(t, 'Look up').props.onClick()); await flush();
    expect(byLabel(t, 'Confirm identity match').props.disabled).toBe(true);
    expect(button(t, 'Save verified link').props.disabled).toBe(true);
  });
  it('mapping: switching customer while lookup is pending discards the stale result', async () => {
    let resolve!: (v: unknown) => void; mock.invoke.mockImplementation(() => new Promise(r => { resolve = r; }));
    const t = await mapping(); await act(async () => { void button(t, 'Look up').props.onClick(); });
    await act(async () => byLabel(t, 'App customer').props.onChange({ target: { value: 'c2' } }));
    await act(async () => { resolve(discovery()); }); await flush();
    expect(t.root.findAll(n => n.props['data-testid'] === 'identity-evidence')).toHaveLength(0);
  });
});
