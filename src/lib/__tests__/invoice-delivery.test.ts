import { describe, it, expect } from 'vitest';
import { resolveInvoiceChannels, finalWeekMonday, chicagoToUtc, idempotencyKey, proposeInvoice, invoiceMessage, announcementText, ANNOUNCEMENT_SMS, ANNOUNCEMENT_EMAIL_BODY } from '../invoice-delivery';

const ok = { phone: '601-555-1234', email: 'a@b.com', smsOptedOut: false, smsConsent: true };

describe('invoice channel resolution', () => {
  it('unset choice defaults to text and email', () => {
    const r = resolveInvoiceChannels({ ...ok, choice: null });
    expect(r.channels).toEqual(['sms', 'email']);
    expect(r.defaulted).toBe(true);
  });
  it('respects a saved single choice', () => {
    expect(resolveInvoiceChannels({ ...ok, choice: 'email' }).channels).toEqual(['email']);
    expect(resolveInvoiceChannels({ ...ok, choice: 'sms' }).channels).toEqual(['sms']);
  });
  it('STOP beats a Text choice', () => {
    const r = resolveInvoiceChannels({ ...ok, choice: 'sms', smsOptedOut: true });
    expect(r.channels).toEqual([]);
    expect(r.skipped[0].reason).toBe('Replied STOP');
  });
  it('no text without consent', () => {
    expect(resolveInvoiceChannels({ ...ok, choice: 'both', smsConsent: false }).channels).toEqual(['email']);
  });
  it('does not promise both when email is missing', () => {
    expect(resolveInvoiceChannels({ ...ok, choice: null, email: '' }).channels).toEqual(['sms']);
  });
});

describe('schedule', () => {
  it('Oct 2026 final week starts Monday Oct 26', () => expect(finalWeekMonday(2026, 10)).toBe('2026-10-26'));
  it('Nov 2026 final week starts Monday Nov 30', () => expect(finalWeekMonday(2026, 11)).toBe('2026-11-30'));
  it('noon Chicago on Oct 26 2026 is CDT = 17:00 UTC', () =>
    expect(chicagoToUtc('2026-10-26', 12).toISOString()).toBe('2026-10-26T17:00:00.000Z'));
  it('noon Chicago on Nov 30 2026 is CST = 18:00 UTC', () =>
    expect(chicagoToUtc('2026-11-30', 12).toISOString()).toBe('2026-11-30T18:00:00.000Z'));
  it('idempotency key is stable per customer and period', () =>
    expect(idempotencyKey('invoice', 'c1', '2026-10')).toBe(idempotencyKey('invoice', 'c1', '2026-10')));
});

describe('legacy proposal calls cannot authorize name-only annual charges', () => {
  it('requires stable identity for annual names', () => {
    expect(proposeInvoice('Peggy McQuarter', 250, '2026-11').blockers).toContain('Confirm stable annual customer identity');
  });
  it('keeps Laken on owner hold despite a valid rate', () => {
    expect(proposeInvoice('Laken Ford Ramey', 125, '2026-11').excluded).toContain('Owner hold');
    expect(proposeInvoice('Laken Ford Ramey', 125, '2026-11').amountCents).toBe(12500);
  });
  it('invalid rates are visible blockers', () => expect(proposeInvoice('Stacy Crosby', 0, '2026-11').blockers).toContain('Confirm monthly rate'));
  it('regular rate becomes cents', () => expect(proposeInvoice('Someone', 250, '2026-11').amountCents).toBe(25000));
  it('text draft includes portal link and STOP', () => {
    const m = invoiceMessage('Ann', 25000, 'November 2026', 'sms');
    expect(m).toContain('getaquaclear.com/auth/login'); expect(m).toContain('STOP');
  });
  it('invoice draft never claims login is required to pay', () => {
    const m = invoiceMessage('Ann', 25000, 'November 2026', 'email');
    expect(m).toContain('no account needed');
    expect(m).not.toContain('Sign in to view and pay');
  });
  it('announcement text is channel-exact: SMS wrapper, email verbatim', () => {
    expect(ANNOUNCEMENT_SMS.startsWith('Aqua Clear Pools:')).toBe(true);
    expect(ANNOUNCEMENT_SMS.endsWith('Reply STOP to opt out.')).toBe(true);
    expect(ANNOUNCEMENT_SMS).toContain(ANNOUNCEMENT_EMAIL_BODY);
    expect(ANNOUNCEMENT_EMAIL_BODY).not.toContain('Reply STOP');
    expect(announcementText('sms')).toBe(ANNOUNCEMENT_SMS);
    expect(announcementText('email')).toBe(ANNOUNCEMENT_EMAIL_BODY);
  });
});
