import { describe, it, expect, vi } from 'vitest';
import { legalRunTransition } from '../../../docs/billing-readiness/server/transitions';
import { enqueueEnrolledApprovals } from '../../../docs/billing-readiness/server/enrolled-queue';
import type { Run, Authority } from '../../../docs/billing-readiness/server/workflow';
import { readinessRow } from '../billing-readiness';
function fixtureSnapshot() {
 const scope = { businessId: 'b1', environment: 'sandbox' as const, realmId: '123' };
 const s = readinessRow({ id: 'c1', customer: 'Monthly', status: 'Active', service_rate: 200, contact_email: 'a@b.com' }, '2026-10', { ...scope,
 enrollment: { enabled: true, firstServicePeriod: '2026-11', revision: 1, updatedBy: 'owner', updatedAt: '2026-10-25T12:09:00Z' },
 mapping: { ...scope, clientId: 'c1', customerId: '114', verified: true, revision: '1' },
 provider: { itemId: '1', incomeAccountId: '2', taxMode: 'non_taxable', taxCode: 'NON', verified: true, revision: '1' , taxReview:{confirmed:true,actor:'00000000-0000-4000-8000-000000000001',reviewedAt:'2026-10-25T12:00:00Z',revision:'1',itemId:'1',incomeAccountId:'2'} }, smsConsent: false, smsOptedOut: false, consentRevision: '1' }).snapshot;
 if (!s) throw new Error('bad_fixture'); return s;
}
it('strict transition rejects state regression and unknown outcome resends', () => {
  const run: Run = { id: '1', auditId: 'a', requestId: 'r', providerInvoiceId: '901', snapshot: fixtureSnapshot(), state: 'reconcile', channels: { email: 'unknown' } };
  expect(legalRunTransition(run, { state: 'claimed' })).toBe(false);
  expect(legalRunTransition(run, { state: 'created', providerInvoiceId: '901' })).toBe(false);
  expect(legalRunTransition(run, { channel: 'email', channelState: 'sent' })).toBe(false);
  expect(legalRunTransition({ ...run, state: 'created', channels: { email: 'sent' } }, { state: 'complete' })).toBe(true);
  expect(legalRunTransition({ ...run, state: 'complete' }, { state: 'blocked' })).toBe(false);
});
describe('enrollment-aware scheduler adapter', () => {
  it('disabled enrollment prevents queued work and entire missed day rejects backfill', async () => {
    const snapshot = fixtureSnapshot();
    const authority: Authority = { authenticate: async () => null,
      policy: async () => ({ businessId: snapshot.businessId, environment: snapshot.environment, realmId: snapshot.realmId, billingMode: 'qbo', invoiceEnabled: true, announcementEnabled: false, migrationVerified: true, deploymentVerified: true, providerVerified: true }),
      approval: async () => null,
      current: async () => ({ ...snapshot, enrollment: { ...snapshot.enrollment, enabled: false, revision: 2 } }),
    };
    const enqueue = vi.fn(); const deps = { authority, enqueue, approvals: async () => [{ id: 'a1', snapshot, approvedBy: 'owner', approvedAt: '2026-10-25', fingerprint: 'unused' }] };
    expect(await enqueueEnrolledApprovals(deps, '2026-11', new Date('2026-10-26T17:00:00Z'))).toBe(0); expect(enqueue).not.toHaveBeenCalled();
    await expect(enqueueEnrolledApprovals(deps, '2026-11', new Date('2026-10-27T17:00:00Z'))).rejects.toThrow('send_day_review_required');
    authority.current = async () => snapshot;
    expect(await enqueueEnrolledApprovals(deps, '2026-11', new Date('2026-10-26T17:00:00Z'))).toBe(1);
    expect(enqueue).toHaveBeenCalledWith('a1');
  });
});
