import { describe, it, expect, vi } from 'vitest';
import { concreteBillingBindings, type RpcGateway } from '../../../docs/billing-readiness/server/supabase-bindings';
import { readinessRow } from '../billing-readiness';
const scope = { businessId: 'b1', environment: 'sandbox' as const, realmId: '123' };
const enrollment = { enabled: true, firstServicePeriod: '2026-11', revision: 1, updatedBy: 'owner', updatedAt: '2026-10-25T12:09:00Z' };
const source = { client: { id: 'c1', customer: 'Monthly', status: 'Active', service_rate: 200, contact_email: 'a@b.com' },
  mapping: { ...scope, clientId: 'c1', customerId: '114', verified: true, revision: '1' },
  provider: { itemId: '1', incomeAccountId: '2', taxCode: 'NON', taxMode: 'non_taxable' as const, verified: true, revision: '1' , taxReview:{confirmed:true,actor:'00000000-0000-4000-8000-000000000001',reviewedAt:'2026-10-25T12:00:00Z',revision:'1',itemId:'1',incomeAccountId:'2'} },
  smsConsent: false, smsOptedOut: false, consentRevision: '1' };
function bindings(response: unknown, failure = false) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const db: RpcGateway = { rpc: async <T>(name: string, args: Record<string, unknown>) => {
    calls.push({ name, args }); return { data: response as T, error: failure ? { message: 'mock error' } : null };
  } };
  const sourceReader = vi.fn(async () => source);
  const b = concreteBillingBindings({ db, scope, source: sourceReader,
    authenticate: async () => null,
    policy: async () => ({ ...scope, billingMode: 'off', invoiceEnabled: false, announcementEnabled: false, migrationVerified: false, deploymentVerified: false, providerVerified: false }) });
  return { b, calls, sourceReader };
}
describe('concrete source-only RPC bindings', () => {
  it('enrollment save uses scoped parameterized RPC and server actor; persistence failures propagate', async () => {
    const { b, calls } = bindings(enrollment);
    await b.repository.save({ ...scope, clientId: 'c1' }, { clientId: 'c1', enabled: true, firstServicePeriod: '2026-11', expectedRevision: 0 }, { id: 'owner', businessId: 'b1', kind: 'admin' });
    expect(calls[0]).toMatchObject({ name: 'qbo_billing_set_enrollment', args: { _business: 'b1', _environment: 'sandbox', _realm: '123', _actor: 'owner', _first: '2026-11' } });
    await expect(bindings(null, true).b.repository.read({ ...scope, clientId: 'c1' })).rejects.toThrow('persistence_failed');
  });
  it('cross-business scope fails before any RPC', async () => {
    const { b, calls } = bindings(enrollment);
    await expect(b.repository.read({ ...scope, businessId: 'evil', clientId: 'c1' })).rejects.toThrow('cross_business'); expect(calls).toHaveLength(0);
  });
  it('authority recomputes amount/mapping/consent and enrollment; OFF fails closed', async () => {
    const snapshot = readinessRow(source.client, '2026-10', { ...scope, ...source, enrollment }).snapshot;
    if (!snapshot) throw new Error('bad_fixture');
    expect(await bindings(enrollment).b.authority.current(snapshot)).toMatchObject({ amountCents: 20000, enrollment });
    expect(await bindings({ ...enrollment, enabled: false, revision: 2 }).b.authority.current(snapshot)).toBeNull();
    const b = bindings(enrollment); b.sourceReader.mockResolvedValue({ ...source, client: { ...source.client, service_rate: 210 } });
    await expect(b.b.synchronize(snapshot)).rejects.toThrow('stale_approval');
  });
  it('channel and resume are scoped atomic RPC contracts', async () => {
    const { b, calls } = bindings(true);
    expect(await b.store.claimChannel('run1', 'email')).toBe(true); expect(await b.claimResume('run1')).toBe(true);
    expect(calls.map(c => c.name)).toEqual(['qbo_billing_channel_scoped', 'qbo_billing_resume_scoped']);
    expect(calls.every(c => c.args._business === 'b1' && c.args._realm === '123')).toBe(true);
  });
});
