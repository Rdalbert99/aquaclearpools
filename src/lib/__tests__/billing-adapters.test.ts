import { describe, it, expect, vi } from 'vitest';
import { readinessRow, snapshotCanonical, coverageOverlaps, batchDates, scheduleDue, type Snapshot } from '../billing-readiness';
import { qboReadAdapter } from '../../../docs/billing-readiness/server/qbo-reads';
import { serverAuthenticator } from '../../../docs/billing-readiness/server/auth';
import { saveReviewedApproval } from '../../../docs/billing-readiness/server/approval';
function fixture(): Snapshot {
  const snapshot = readinessRow({ id: 'c1', customer: 'Monthly', status: 'Active', service_rate: 200 }, '2026-10', {
    businessId: 'b1', environment: 'sandbox', realmId: '123', choice: 'email', smsConsent: false, smsOptedOut: false, consentRevision: '1',
    mapping: { businessId: 'b1', environment: 'sandbox', realmId: '123', clientId: 'c1', customerId: '114', verified: true, revision: '1' },
    provider: { itemId: '1', incomeAccountId: '2', taxCode: 'NON', taxMode: 'non_taxable', verified: true, revision: '1' },
  });
  // Fixture with real email eligibility; no provider or live effect.
  const s = readinessRow({ ...snapshot.client, contact_email: 'a@b.com' }, '2026-10', {
    businessId: 'b1', environment: 'sandbox', realmId: '123', choice: 'email', smsConsent: false, smsOptedOut: false, consentRevision: '1',
    mapping: { businessId: 'b1', environment: 'sandbox', realmId: '123', clientId: 'c1', customerId: '114', verified: true, revision: '1' },
    provider: { itemId: '1', incomeAccountId: '2', taxCode: 'NON', taxMode: 'non_taxable', verified: true, revision: '1' },
  }).snapshot;
  if (!s) throw new Error('bad_fixture'); return s;
}
function reads(data: unknown) {
  const fetch = vi.fn(async () => ({ status: 200, text: async () => JSON.stringify(data), headers: { get: () => null } }));
  const adapter = qboReadAdapter({ environment: 'sandbox', realmId: '123', fetch, authorization: async () => 'mock', verifyTax: async () => false });
  return { fetch, adapter };
}
describe('prepared adapters', () => {
  it('paid manual invoice prevents a duplicate new invoice', async () => {
    const s = fixture();
    const { adapter } = reads({ QueryResponse: { Invoice: [{ Id: '901', CustomerRef: { value: '114' }, TotalAmt: 200, Balance: 0, DueDate: s.dueDate, Line: [{ Description: `Pool service ${s.serviceStart} through ${s.serviceEnd}` }] }] } });
    expect((await adapter.existing(s)).exact[0].id).toBe('901');
    expect((await adapter.balances(s)).invoices).toEqual([]);
  });
  it('malformed lookup and wrong customer never return zero', async () => {
    await expect(reads({}).adapter.balances(fixture())).rejects.toThrow('read_failed');
    await expect(reads({ QueryResponse: { Invoice: [{ Id: '1', CustomerRef: { value: '999' } }] } }).adapter.balances(fixture())).rejects.toThrow('read_failed');
  });
  it('same due date without confirmed coverage is ambiguous', async () => {
    const s = fixture(); const { adapter } = reads({ QueryResponse: { Invoice: [{ Id: '1', CustomerRef: { value: '114' }, DueDate: s.dueDate, TotalAmt: 200, Balance: 200 }] } });
    expect((await adapter.existing(s)).status).toBe('ambiguous');
  });
  it('cross realm read rejected before transport', async () => {
    const { adapter, fetch } = reads({ QueryResponse: {} });
    await expect(adapter.balances({ ...fixture(), realmId: '999' })).rejects.toThrow('cross_realm'); expect(fetch).not.toHaveBeenCalled();
  });
  it('annual coverage blocks later monthly slot, separate customer does not collide', () => {
    const s = fixture(); const annual = { ...s, frequency: 'annual' as const, serviceEnd: '2027-10-31' };
    const monthly = { ...s, servicePeriod: '2026-12', serviceStart: '2026-12-01', serviceEnd: '2026-12-31' };
    expect(coverageOverlaps(annual, monthly)).toBe(true); expect(coverageOverlaps(annual, { ...monthly, clientId: 'c2' })).toBe(false);
  });
  it('delayed same-day schedule catches up without invented morning time', () => {
    expect(scheduleDue(new Date('2026-10-26T18:15:00Z'), { invoiceEnabled: true, announcementEnabled: false, announcementHour: null }).invoice).toBe(true);
    expect(batchDates('2026-10').dueDate).toBe('2026-11-01');
  });
  it('server user and role are verified, user-submitted role cannot authorize', async () => {
    const auth = serverAuthenticator({ getUser: async jwt => jwt === 'valid-test' ? { id: 'u1' } : null, adminBusiness: async () => null, scheduler: null });
    expect(await auth('Bearer valid-test')).toBeNull(); expect(await auth('admin')).toBeNull();
    const admin = serverAuthenticator({ getUser: async () => ({ id: 'u1' }), adminBusiness: async () => 'b1', scheduler: null });
    expect(await admin('Bearer valid-test')).toMatchObject({ kind: 'admin', businessId: 'b1' });
  });
  it('stale rate rejects approval save; save failures propagate', async () => {
    const s = fixture();
    const deps = { authenticate: async () => ({ id: 'u1', businessId: 'b1', kind: 'admin' as const }), transact: async (_: unknown, review: (s: Snapshot) => Snapshot) => ({ id: 'a1', snapshot: review({ ...s, amountCents: 21000 }), approvedBy: 'u1', approvedAt: '2026-10-25', fingerprint: snapshotCanonical(s) }) };
    await expect(saveReviewedApproval(deps, 'mock', { clientId: 'c1', sendMonth: '2026-10', reviewed: s })).rejects.toThrow('stale_approval');
    await expect(saveReviewedApproval({ ...deps, transact: async () => { throw new Error('save_failed'); } }, 'mock', { clientId: 'c1', sendMonth: '2026-10', reviewed: s })).rejects.toThrow('save_failed');
  });
});
