import { describe, it, expect } from 'vitest';
import { isAllowedReturnUrl, safeDocNumber, summarizeInvoice } from '../../../supabase/functions/_shared/qbo-summary';

const paidInvoice = {
  QueryResponse: {
    Invoice: [{
      Id: '901', DocNumber: '350154860', TotalAmt: 5, Balance: 0, TxnDate: '2026-10-20',
      CustomerRef: { value: '114', name: 'Aqua Clear Integration Test' },
      LinkedTxn: [{ TxnId: '77', TxnType: 'Payment' }],
    }],
  },
};

describe('QuickBooks invoice summary (read-only test)', () => {
  it('reads the $5 test invoice as paid with $0 balance for customer 114', () => {
    const s = summarizeInvoice('350154860', paidInvoice);
    expect(s).toMatchObject({ found: true, customerId: '114', totalCents: 500, balanceCents: 0, paidCents: 500, status: 'paid' });
    expect(s.linkedPaymentIds).toEqual(['77']);
  });
  it('reports partially paid and open correctly', () => {
    const mk = (bal: number) => ({ QueryResponse: { Invoice: [{ Id: '1', TotalAmt: 5, Balance: bal }] } });
    expect(summarizeInvoice('1', mk(2.5)).status).toBe('partially_paid');
    expect(summarizeInvoice('1', mk(5)).status).toBe('open');
  });
  it('reports not found when QuickBooks returns no invoice', () => {
    expect(summarizeInvoice('350154860', { QueryResponse: {} })).toEqual({ found: false, docNumber: '350154860' });
  });
  it('rejects invoice numbers that could alter the query', () => {
    expect(safeDocNumber('350154860')).toBe('350154860');
    expect(safeDocNumber("1' or '1'='1")).toBeNull();
    expect(safeDocNumber('')).toBeNull();
  });
  it('only returns to Aqua Clear addresses after sign-in', () => {
    expect(isAllowedReturnUrl('https://getaquaclear.com/admin/quickbooks')).toBe(true);
    expect(isAllowedReturnUrl('https://aquaclear-pools.lovable.app/admin/quickbooks')).toBe(true);
    expect(isAllowedReturnUrl('https://evil.example.com/')).toBe(false);
    expect(isAllowedReturnUrl('http://getaquaclear.com/')).toBe(false);
  });
});
