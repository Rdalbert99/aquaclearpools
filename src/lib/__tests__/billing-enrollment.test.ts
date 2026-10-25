import { describe, it, expect, vi } from 'vitest';
import { proposeForClient, defaultEnrollment, enrollmentBlocker, OWNER_IDS, datesForServiceMonth, approvalIsFresh, type Enrollment } from '../billing-readiness';
import { saveEnrollment, pendingEnrollmentAdapter, endpointEnrollmentAdapter, firstMonthLabel } from '../billing-enrollment';
import { reviewedBootstrap } from '../../../docs/billing-readiness/server/bootstrap';
import { enrollmentService, type EnrollmentRepository } from '../../../docs/billing-readiness/server/enrollment';
import { billingEndpoint } from '../../../docs/billing-readiness/server/endpoint';
const first: Enrollment = { enabled: true, firstServicePeriod: '2026-11', revision: 1, updatedBy: 'owner', updatedAt: '2026-10-25T12:09:00Z' };
const client = { id: 'c1', customer: 'Monthly Customer', status: 'Active', service_rate: 200 };
const scope = { businessId: 'b1', environment: 'sandbox' as const, realmId: '123', clientId: OWNER_IDS.peggy };
function service(overrides?: Partial<EnrollmentRepository>) {
  let stored: Enrollment | null = null;
  const repository: EnrollmentRepository = {
    clientBelongsToBusiness: async () => true,
    read: async () => stored,
    save: async (_, input, actor) => {
      if ((stored?.revision ?? 0) !== input.expectedRevision) throw new Error('stale_enrollment');
      stored = { enabled: input.enabled, firstServicePeriod: input.firstServicePeriod, revision: input.expectedRevision + 1, updatedBy: actor.id, updatedAt: '2026-10-25T12:20:00Z' };
      return stored;
    }, ...overrides,
  };
  return enrollmentService({ authenticate: async credential => credential === 'mock' ? { id: 'owner', kind: 'admin', businessId: 'b1' } : null,
    scope: async () => ({ businessId: 'b1', environment: 'sandbox', realmId: '123' }), repository, now: () => new Date('2026-10-25T12:20:00Z') });
}
describe('customer automatic invoicing', () => {
  it('new Active customer defaults off; missing backend never authorizes invoice', () => {
    expect(defaultEnrollment().enabled).toBe(false);
    expect(proposeForClient(client, '2026-11').excluded).toContain('Enrollment not saved');
    expect(proposeForClient(client, '2026-11', undefined, { ...first, enabled: false }).excluded).toBe('Automatic invoicing off');
  });
  it('explicit future first month excludes early service without backbilling', () => {
    const enrollment = { ...first, firstServicePeriod: '2026-12' };
    expect(proposeForClient(client, '2026-11', undefined, enrollment).excluded).toContain('Before first billing month');
    expect(proposeForClient(client, '2026-12', undefined, enrollment).excluded).toBeNull();
    expect(proposeForClient(client, '2027-01', undefined, enrollment).amountCents).toBe(20000);
  });
  it('frozen reviewed cohort excludes future newcomers and Laken remains off', () => {
    const cohort = reviewedBootstrap({ approved: true, reviewedBy: 'owner', asOf: '2026-10-25T12:09:00Z', members: [
      { clientId: 'existing', statusAtCapture: 'Active', createdAt: '2026-10-01' },
      { clientId: OWNER_IDS.laken, statusAtCapture: 'Active', createdAt: '2026-10-01' },
      { clientId: 'future', statusAtCapture: 'Active', createdAt: '2026-10-26' },
      { clientId: 'inactive', statusAtCapture: 'Inactive', createdAt: '2026-10-01' },
    ] });
    expect(cohort).toEqual([{ clientId: 'existing', enabled: true, firstServicePeriod: '2026-11' }, { clientId: OWNER_IDS.laken, enabled: false, firstServicePeriod: '2026-11' }]);
    expect(() => reviewedBootstrap({ approved: false, reviewedBy: 'owner', asOf: '2026-10-25', members: [] })).toThrow('cohort_review_required');
  });
  it('Laken hold wins over enabled and renamed customer; preserves125', () => {
    const p = proposeForClient({ ...client, id: OWNER_IDS.laken, customer: 'Renamed', service_rate: 125 }, '2026-11', undefined, first);
    expect(p.excluded).toContain('Owner hold'); expect(p.amountCents).toBe(12500);
  });
  it('Peggy confirmed $3000 November only, no monthly duplicate; unknown annual configs stay blocked', () => {
    const peggy = { ...client, id: OWNER_IDS.peggy, service_rate: 250 };
    expect(proposeForClient(peggy, '2026-11', undefined, first)).toMatchObject({ amountCents: 300000, channelOverride: 'sms', frequency: 'annual', excluded: null, blockers: [], serviceStart: '2026-11-01', serviceEnd: '2027-10-31' });
    expect(proposeForClient(peggy, '2026-12', undefined, first).excluded).toContain('Annual non-renewal');
    for (const id of [OWNER_IDS.shelby, OWNER_IDS.jennifer]) expect(proposeForClient({ ...client, id }, '2026-11', undefined, first).blockers).toHaveLength(2);
  });
  it('first service month inverse handles year, leap and DST; November sends October26 dueNovember1', () => {
    expect(datesForServiceMonth('2026-11')).toMatchObject({ sendDay: '2026-10-26', sendAt: '2026-10-26T17:00:00.000Z', dueDate: '2026-11-01' });
    expect(datesForServiceMonth('2027-01')).toMatchObject({ sendMonth: '2026-12', sendAt: '2026-12-28T18:00:00.000Z' });
    expect(datesForServiceMonth('2028-02').serviceEnd).toBe('2028-02-29');
    expect(firstMonthLabel('2026-11')).toContain('November 2026 service — sent 2026-10-26');
  });
  it('off/on revision invalidates queued approval; early old months never replay', () => {
    expect(enrollmentBlocker({ ...first, enabled: false, revision: 2 }, '2026-11')).toBe('Automatic invoicing off');
    expect(proposeForClient(client, '2026-11', undefined, { ...first, revision: 3, firstServicePeriod: '2026-12' }).excluded).toContain('Before first billing month');
    expect(approvalIsFresh(null, null)).toBe(false);
  });
  it('pending frontend save fails visibly without invoking provider or storage', async () => {
    await expect(saveEnrollment(pendingEnrollmentAdapter, scope, { enabled: true, firstServicePeriod: '2026-11', expectedRevision: 0 })).rejects.toThrow('Not saved');
    const invoke = vi.fn(async () => ({ error: 'persistence_failed' }));
    await expect(saveEnrollment(endpointEnrollmentAdapter(invoke), scope, { enabled: true, firstServicePeriod: '2026-11', expectedRevision: 0 })).rejects.toThrow('persistence_failed');
  });
  it('server save authorized with revision readback; default read off, unauthorized / cross business fail', async () => {
    const app = service(); expect(await app.read('mock', OWNER_IDS.peggy)).toBeNull();
    const input = { clientId: OWNER_IDS.peggy, enabled: true, firstServicePeriod: '2026-11', expectedRevision: 0 };
    await expect(app.save('wrong', input)).rejects.toThrow('unauthorized');
    expect(await app.save('mock', input)).toMatchObject({ enabled: true, revision: 1, updatedBy: 'owner' });
    await expect(app.save('mock', input)).rejects.toThrow('stale_enrollment');
    await expect(service({ clientBelongsToBusiness: async () => false }).save('mock', input)).rejects.toThrow('cross_business');
  });
  it('save rejects owner hold, invented scope fields and missed send days', async () => {
    const app = service();
    await expect(app.save('mock', { clientId: OWNER_IDS.laken, enabled: true, firstServicePeriod: '2026-11', expectedRevision: 0 })).rejects.toThrow('owner_hold');
    await expect(app.save('mock', { clientId: OWNER_IDS.peggy, enabled: true, firstServicePeriod: '2026-10', expectedRevision: 0 })).rejects.toThrow('missed_send_day_review_required');
    await expect(app.save('mock', { clientId: OWNER_IDS.peggy, enabled: true, firstServicePeriod: '2026-11', expectedRevision: 0, businessId: 'evil' })).rejects.toThrow();
  });
  it('disabled endpoint never calls persistence/execution; invalid auth and origins fail closed', async () => {
    const execute = vi.fn(async () => ({ state: 'complete' }));
    const endpoint = billingEndpoint({ enabled: false, allowedOrigins: ['http://localhost:8080'], enrollment: service(), execute });
    expect((await endpoint(new Request('http://localhost:8080/billing', { method: 'POST' }))).status).toBe(503);
    expect((await endpoint(new Request('http://localhost:8080/billing', { method: 'POST', headers: { Origin: 'https://evil.example' } }))).status).toBe(403);
    expect(execute).not.toHaveBeenCalled();
  });
});
