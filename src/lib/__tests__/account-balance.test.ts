import { describe, it, expect } from 'vitest';
import { accountSummary, balanceDraftLines } from '../account-balance';
import { invoiceMessage, resolveInvoiceChannels } from '../invoice-delivery';
import { normalizeOpenInvoices, safeCustomerId } from '../../../supabase/functions/_shared/qbo-balance';

const today = '2026-10-26';
const qbo = (rows: any[]) => ({ QueryResponse: { Invoice: rows } });
const boswellEquip = { Id: '901', DocNumber: '1045', CustomerRef: { value: '77' }, TotalAmt: 220, Balance: 220, DueDate: '2026-10-01', InvoiceLink: 'https://connect.intuit.com/pay/abc' };

describe('outstanding balance (Boswell example)', () => {
  it('old $220 + new $200 = $420 total while the new invoice stays $200', () => {
    const s = accountSummary(20000, { status: 'ok', invoices: normalizeOpenInvoices(qbo([boswellEquip]), '77') }, today);
    expect(s.newInvoiceCents).toBe(20000);
    expect(s.previousCents).toBe(22000);
    expect(s.totalCents).toBe(42000);
    expect(s.pastDue).toBe(true);
    expect(s.previous[0].paymentLink).toBe('https://connect.intuit.com/pay/abc');
  });

  it('draft shows $200 invoice and earlier balance separately', () => {
    const s = accountSummary(20000, { status: 'ok', invoices: normalizeOpenInvoices(qbo([boswellEquip]), '77') }, today);
    const msg = invoiceMessage('Robert', 20000, 'November 2026', 'sms', balanceDraftLines(s));
    expect(msg).toContain('invoice is $200.00');
    expect(msg).toContain('#1045 $220.00 (past due)');
    expect(msg).toContain('Account total due: $420.00');
  });

  it('partial payment uses the current QuickBooks balance', () => {
    const s = accountSummary(20000, { status: 'ok', invoices: normalizeOpenInvoices(qbo([{ ...boswellEquip, Balance: 120 }]), '77') }, today);
    expect(s.previousCents).toBe(12000);
    expect(s.totalCents).toBe(32000);
  });

  it('paid invoice ($0 balance) is not counted', () => {
    const s = accountSummary(20000, { status: 'ok', invoices: normalizeOpenInvoices(qbo([{ ...boswellEquip, Balance: 0 }]), '77') }, today);
    expect(s.previousCents).toBe(0);
    expect(s.totalCents).toBe(20000);
  });

  it('multiple invoices add up; duplicate rows count once', () => {
    const second = { ...boswellEquip, Id: '902', DocNumber: '1050', TotalAmt: 50.5, Balance: 50.5, DueDate: '2026-11-15' };
    const s = accountSummary(20000, { status: 'ok', invoices: normalizeOpenInvoices(qbo([boswellEquip, boswellEquip, second]), '77') }, today);
    expect(s.previousCents).toBe(27050);
    expect(s.totalCents).toBe(47050);
    expect(s.previous.find((i) => i.id === '902')!.pastDue).toBe(false);
  });

  it('new invoice already in QuickBooks is not counted twice (idempotent)', () => {
    const newOne = { ...boswellEquip, Id: '950', DocNumber: '1060', TotalAmt: 200, Balance: 200, DueDate: '2026-11-01' };
    const inv = normalizeOpenInvoices(qbo([boswellEquip, newOne]), '77');
    const a = accountSummary(20000, { status: 'ok', invoices: inv }, today, '950');
    const b = accountSummary(20000, { status: 'ok', invoices: inv }, today, '950');
    expect(a.totalCents).toBe(42000);
    expect(b).toEqual(a);
  });

  it('rows for a different QuickBooks customer are ignored', () => {
    const other = { ...boswellEquip, Id: '999', CustomerRef: { value: '78' } };
    expect(normalizeOpenInvoices(qbo([other]), '77')).toEqual([]);
  });

  it('unmatched customer: balance unavailable, no combined total, not $0', () => {
    const s = accountSummary(20000, { status: 'unavailable', reason: 'Not linked to a QuickBooks customer' }, today);
    expect(s.available).toBe(false);
    expect(s.totalCents).toBeNull();
    expect(s.previousCents).toBeNull();
    expect(balanceDraftLines(s)).toBe('');
  });

  it('malformed QuickBooks data throws instead of reading as $0', () => {
    expect(() => normalizeOpenInvoices({}, '77')).toThrow();
    expect(() => normalizeOpenInvoices(qbo([{ ...boswellEquip, Balance: 'abc' }]), '77')).toThrow();
  });

  it('customer IDs must be numeric', () => {
    expect(safeCustomerId('114')).toBe('114');
    expect(safeCustomerId("1' or '1'='1")).toBeNull();
    expect(safeCustomerId('Robert Boswell')).toBeNull();
  });

  it('STOP still removes text even when a balance is owed', () => {
    const r = resolveInvoiceChannels({ choice: 'both', phone: '601-555-1234', email: 'a@b.com', smsOptedOut: true, smsConsent: true });
    expect(r.channels).toEqual(['email']);
  });

  it('no text consent means email only', () => {
    const r = resolveInvoiceChannels({ choice: 'both', phone: '601-555-1234', email: 'a@b.com', smsOptedOut: false, smsConsent: false });
    expect(r.channels).toEqual(['email']);
  });
});
