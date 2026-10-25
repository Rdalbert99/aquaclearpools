import { describe, it, expect } from 'vitest';
import { batchDates, initialSendMonth, isActiveClient, OWNER_IDS, proposeForClient, readinessRow, approvedTotals, approvalIsFresh, invoiceSlot, scheduleDue, type Snapshot, type BillingClient } from '../billing-readiness';
const client: BillingClient = { id: 'c1', customer: 'Monthly Customer', status: 'Active', service_rate: 200, contact_phone: '6015551234', contact_email: 'a@b.com' };
const context = { businessId: 'b1', environment: 'sandbox' as const, realmId: '123', mapping: { businessId: 'b1', environment: 'sandbox' as const, realmId: '123', clientId: 'c1', customerId: '114', verified: true, revision: '1' }, provider: { itemId: '1', incomeAccountId: '2', taxCode: 'NON', taxMode: 'non_taxable' as const, verified: true, revision: '1' }, smsConsent: true, smsOptedOut: false, consentRevision: '1' };
export function fixtureSnapshot(): Snapshot {
  const s = readinessRow(client, '2026-10', context).snapshot;
  if (!s) throw new Error('fixture_not_ready'); return s;
}
describe('owner billing rules', () => {
  it('includes exact Active fixture, case and whitespace, excludes inactive/suspended', () => {
    expect(['Active', ' active ', 'ACTIVE', 'Inactive', 'Suspended'].filter(isActiveClient)).toEqual(['Active', ' active ', 'ACTIVE']);
    expect(readinessRow(client, '2026-10', context).snapshot?.amountCents).toBe(20000);
  });
  it('Laken stable ID is held without changing $125 rate', () => {
    const c = { ...client, id: OWNER_IDS.laken, customer: 'Renamed Customer', service_rate: 125 };
    const p = proposeForClient(c, '2026-11');
    expect(p.excluded).toContain('Owner hold'); expect(p.amountCents).toBe(12500); expect(c.service_rate).toBe(125);
  });
  it('Laken exact name fallback holds without matching unrelated names', () => {
    expect(proposeForClient({ ...client, customer: ' Laken Ford Ramey ' }, '2026-11').excluded).toContain('Owner hold');
    expect(proposeForClient({ ...client, customer: 'Not Laken Ford Ramey' }, '2026-11').excluded).toBeNull();
  });
  it('Oct 26 noon sends November due first', () => expect(batchDates('2026-10')).toMatchObject({ sendDay: '2026-10-26', sendAt: '2026-10-26T17:00:00.000Z', servicePeriod: '2026-11', dueDate: '2026-11-01' }));
  it('Nov 30 noon sends December due first', () => expect(batchDates('2026-11')).toMatchObject({ sendDay: '2026-11-30', sendAt: '2026-11-30T18:00:00.000Z', servicePeriod: '2026-12', dueDate: '2026-12-01' }));
  it('December rolls into January in CST', () => expect(batchDates('2026-12')).toMatchObject({ sendAt: '2026-12-28T18:00:00.000Z', servicePeriod: '2027-01', dueDate: '2027-01-01' }));
  it('leap February and spring DST work', () => {
    expect(batchDates('2028-01').serviceEnd).toBe('2028-02-29');
    expect(batchDates('2027-03').sendAt).toBe('2027-03-29T17:00:00.000Z');
    expect(initialSendMonth(new Date('2027-01-01T02:00:00Z'))).toBe('2026-12');
  });
  it('Peggy one annual November renewal preserving reviewable $3000', () => {
    const p = proposeForClient({ ...client, id: OWNER_IDS.peggy, customer: 'Peggy McQuarter', service_rate: 250 }, '2026-11');
    expect(p).toMatchObject({ frequency: 'annual', amountCents: 300000, channelOverride: 'sms', serviceStart: '2026-11-01', serviceEnd: '2027-10-31', dueDate: '2026-11-01', excluded: null });
    expect(p.blockers).toContain('Confirm annual amount (never monthly rate × 12)');
  });
  it('annual nonrenewal never gets extra monthly bill', () => expect(proposeForClient({ ...client, id: OWNER_IDS.peggy }, '2026-12')).toMatchObject({ frequency: 'annual', excluded: 'Annual non-renewal month — no monthly invoice' }));
  it.each([OWNER_IDS.shelby, OWNER_IDS.jennifer])('prepaid %s unknown config stays excluded', id => {
    const p = proposeForClient({ ...client, id }, '2026-11');
    expect(p.frequency).toBe('annual'); expect(p.amountCents).toBeNull(); expect(p.blockers).toHaveLength(2); expect(p.excluded).toContain('preserve exclusion');
  });
  it('confirmed annual config uses its amount, not monthly multiplication', () => {
    const p = proposeForClient({ ...client, id: OWNER_IDS.shelby }, '2026-11', { frequency: 'annual', renewalMonth: 11, renewalConfirmed: true, amountCents: 270000, amountConfirmed: true, revision: '2' });
    expect(p.amountCents).toBe(270000); expect(p.excluded).toBeNull();
  });
  it('missing mapping is a blocker, cross realm mapping refused', () => {
    expect(readinessRow(client, '2026-10', { ...context, mapping: undefined }).snapshot).toBeNull();
    expect(readinessRow(client, '2026-10', { ...context, realmId: '999' }).snapshot).toBeNull();
  });
  it('STOP overrides text and no consent cannot manufacture SMS', () => {
    expect(readinessRow(client, '2026-10', { ...context, smsOptedOut: true }).delivery.channels).toEqual(['email']);
    expect(readinessRow(client, '2026-10', { ...context, smsConsent: false }).delivery.channels).toEqual(['email']);
    expect(readinessRow({ ...client, contact_email: null }, '2026-10', { ...context, smsConsent: false }).snapshot).toBeNull();
  });
  it('missing amount blocks but does not omit active customer', () => {
    const r = readinessRow({ ...client, service_rate: null }, '2026-10', context);
    expect(r.client.id).toBe('c1'); expect(r.blockers).toContain('Confirm monthly rate'); expect(r.snapshot).toBeNull();
  });
  it('changed rate/config/contacts invalidates approval and total', () => {
    const s = fixtureSnapshot();
    for (const changed of [{ ...s, amountCents: 21000 }, { ...s, configRevision: '2' }, { ...s, contactEmail: 'changed@b.com' }]) {
      expect(approvalIsFresh(s, changed)).toBe(false);
      expect(approvedTotals([{ snapshot: s, current: changed }])).toEqual({ count: 0, amountCents: 0 });
    }
    expect(approvedTotals([{ snapshot: s, current: s }])).toEqual({ count: 1, amountCents: 20000 });
  });
  it('monthly and annual collide in same durable slot', () => {
    const s = fixtureSnapshot(); const annual: Snapshot = { ...s, frequency: 'annual' }; expect(invoiceSlot(s)).toBe(invoiceSlot(annual));
  });
  it('schedule defaults off and unresolved morning blocks announcement', () => {
    const at = new Date('2026-10-26T17:00:00Z');
    expect(scheduleDue(at, { invoiceEnabled: false, announcementEnabled: false, announcementHour: null }).invoice).toBe(false);
    expect(scheduleDue(at, { invoiceEnabled: true, announcementEnabled: true, announcementHour: null })).toMatchObject({ invoice: true, announcement: false, announcementBlocker: 'Announcement morning hour requires owner approval' });
  });
});
