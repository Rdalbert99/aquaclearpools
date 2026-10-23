import { describe, it, expect } from 'vitest';
import { resolveInvoiceChannels, finalWeekMonday, chicagoToUtc, idempotencyKey, proposeInvoice, invoiceMessage } from '../invoice-delivery';

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

describe('roster rules', () => {
  it('Peggy McQuarter: $3000 annual, text only, October', () => {
    const p = proposeInvoice('Peggy McQuarter', 250, '2026-10');
    expect(p.amountCents).toBe(300000);
    expect(p.channelOverride).toBe('sms');
    expect(p.excluded).toBeNull();
  });
  it('Peggy gets no extra monthly invoice in November', () =>
    expect(proposeInvoice('Peggy McQuarter', 250, '2026-11').excluded).not.toBeNull());
  it('Shelby Thames and Jennifer Robinson excluded (annual due late Nov)', () => {
    expect(proposeInvoice('Shelby Thames', 250, '2026-10').excluded).toMatch(/November/);
    expect(proposeInvoice('Jennifer Robinson', 250, '2026-10').excluded).toMatch(/November/);
  });
  it('Laken Ford Ramey excluded pending rate', () =>
    expect(proposeInvoice('Laken Ford Ramey', 250, '2026-10').excluded).toBe('Rate pending'));
  it('$0 rate is excluded as uncertain', () => expect(proposeInvoice('Stacy Crosby', 0, '2026-10').excluded).toBe('No confirmed rate'));
  it('regular rate becomes cents', () => expect(proposeInvoice('Someone', 250, '2026-10').amountCents).toBe(25000));
  it('text invoice includes portal link and STOP', () => {
    const m = invoiceMessage('Ann', 25000, 'October 2026', 'sms');
    expect(m).toContain('getaquaclear.com/auth/login');
    expect(m).toContain('STOP');
  });
});
