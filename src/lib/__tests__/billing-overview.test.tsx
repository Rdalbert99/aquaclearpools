import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
const mock = vi.hoisted(() => ({ invoke: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/billing-transport', () => ({ billingInvoke: mock.invoke, authenticatedEnrollmentAdapter: { ready: true } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mock.from, functions: { invoke: mock.invoke }, auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } } }));
vi.mock('@/components/ui/tabs', () => ({ Tabs: ({ children }: React.PropsWithChildren) => <div>{children}</div>, TabsContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>, TabsList: ({ children }: React.PropsWithChildren) => <div>{children}</div>, TabsTrigger: ({ children }: React.PropsWithChildren) => <span>{children}</span> }));
import { BillingOverview, overviewValues, type OverviewInvoice } from '@/components/billing/BillingOverview';
import InvoiceDelivery from '@/pages/admin/InvoiceDelivery';

const inv = (p: Partial<OverviewInvoice>): OverviewInvoice => ({ id: '1', number: '1001', issuedDate: '2026-10-26', dueDate: '2026-11-01', amountCents: 20000, balanceCents: 0, payment: 'paid', paidDate: '2026-10-27', lastPaymentDate: '2026-10-27', recordedPaymentCents: 20000, received: 'unconfirmed', qboEmailSent: true, ...p });
const drain = async () => { await act(async () => { await new Promise(r => setTimeout(r, 0)); }); };
const text = (t: ReactTestRenderer) => JSON.stringify(t.toJSON());
beforeEach(() => vi.clearAllMocks());

describe('invoice overview values', () => {
  it('paid invoice shows Paid with actual payment date; received stays Not confirmed', () => {
    const v = overviewValues({ clientId: 'c', customer: 'A', status: 'ok', invoices: [inv({})], totalDueCents: 0 });
    expect(v).toMatchObject({ paid: 'Paid', paidDate: '2026-10-27', received: 'Not confirmed', amount: '$200.00', due: '$0.00' });
  });
  it('zero balance without payment evidence is not Paid', () => {
    const v = overviewValues({ clientId: 'c', customer: 'A', status: 'ok', invoices: [inv({ payment: 'settled_unverified', paidDate: null })], totalDueCents: 0 });
    expect(v.paid).toContain('payment unverified'); expect(v.paidDate).toBe('');
  });
  it('zero invoice is never Paid', () => {
    expect(overviewValues({ clientId: 'c', customer: 'A', status: 'ok', invoices: [inv({ amountCents: 0, payment: 'zero_invoice', paidDate: null })], totalDueCents: 0 }).paid).toContain('not a payment');
  });
  it('total due comes only from server all-open balance, not added to the invoice amount', () => {
    const v = overviewValues({ clientId: 'c', customer: 'A', status: 'ok', invoices: [inv({ payment: 'unpaid', balanceCents: 20000, paidDate: null })], totalDueCents: 42000 });
    expect(v.amount).toBe('$200.00'); expect(v.due).toBe('$420.00'); expect(v.paid).toBe('Unpaid');
  });
  it('part paid and multiple invoices', () => {
    const v = overviewValues({ clientId: 'c', customer: 'A', status: 'ok', invoices: [inv({ payment: 'part_paid', paidDate: null }), inv({ id: '2', issuedDate: '2026-10-05' })], totalDueCents: 5000 });
    expect(v.invoiced).toBe('Yes · 2 invoices'); expect(v.date).toBe('2026-10-05 – 2026-10-26'); expect(v.amount).toBe('$400.00'); expect(v.paid).toBe('See invoice details');
  });
  it('unavailable row or null total never shows $0', () => {
    expect(overviewValues({ clientId: 'c', customer: 'A', status: 'unavailable', reason: 'No verified mapping' }).due).toBe('Unavailable');
    expect(overviewValues({ clientId: 'c', customer: 'A', status: 'ok', invoices: [], totalDueCents: null }).due).toBe('Unavailable');
  });
});

describe('rendered overview', () => {
  it('pages, links exact clientId, and does not load technical readiness or owner test on page read', async () => {
    mock.invoke.mockImplementation(async (b: { action: string; offset: number; issuedMonth: string }) => {
      if (b.action !== 'invoice_overview') throw new Error('unexpected ' + b.action);
      return b.offset === 0 ? { issuedMonth: b.issuedMonth, rows: [{ clientId: 'id-b', customer: 'Bee', status: 'ok', invoices: [inv({})], totalDueCents: 0 }], nextOffset: 10, asOf: '2026-10-27T15:00:00Z' }
        : { issuedMonth: b.issuedMonth, rows: [{ clientId: 'id-a', customer: 'Ann', status: 'unavailable', reason: 'No verified mapping' }], nextOffset: null, asOf: '2026-10-27T15:00:00Z' };
    });
    let t: ReactTestRenderer | undefined;
    await act(async () => { t = create(<MemoryRouter><InvoiceDelivery /></MemoryRouter>); });
    await drain(); await drain();
    const links = t!.root.findAll(n => n.type === 'a').map(a => a.props.href);
    expect(links).toContain('/admin/clients/id-a'); expect(links).toContain('/admin/clients/id-b');
    expect(mock.invoke.mock.calls.every(c => c[0].action === 'invoice_overview')).toBe(true);
    expect(text(t!)).not.toContain('Owner');
    await act(async () => t!.unmount());
  });
  it('late response from an old month never appears after month change', async () => {
    let resolveOld: ((v: unknown) => void) | undefined;
    mock.invoke.mockImplementation((b: { issuedMonth: string }) => b.issuedMonth === '2026-10' ? new Promise(r => { resolveOld = r; })
      : Promise.resolve({ issuedMonth: b.issuedMonth, rows: [{ clientId: 'n', customer: 'November', status: 'ok', invoices: [], totalDueCents: 0 }], nextOffset: null, asOf: '' }));
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-27T15:00:00Z'));
    let t: ReactTestRenderer | undefined;
    await act(async () => { t = create(<MemoryRouter><BillingOverview /></MemoryRouter>); });
    vi.useRealTimers();
    await act(async () => t!.root.findByProps({ 'aria-label': 'Invoice issue month' }).props.onChange({ target: { value: '2026-11' } }));
    await drain();
    await act(async () => resolveOld?.({ issuedMonth: '2026-10', rows: [{ clientId: 'o', customer: 'OldMonth', status: 'ok', invoices: [], totalDueCents: 0 }], nextOffset: null, asOf: '' }));
    expect(text(t!)).toContain('November'); expect(text(t!)).not.toContain('OldMonth');
    await act(async () => t!.unmount());
  });
  it('mismatched month response fails closed without rows', async () => {
    mock.invoke.mockResolvedValue({ issuedMonth: '1999-01', rows: [{ clientId: 'x', customer: 'Wrong', status: 'ok', invoices: [], totalDueCents: 0 }], nextOffset: null, asOf: '' });
    let t: ReactTestRenderer | undefined;
    await act(async () => { t = create(<MemoryRouter><BillingOverview /></MemoryRouter>); });
    await drain();
    expect(text(t!)).not.toContain('Wrong'); expect(text(t!)).toContain('Nothing unavailable is counted as zero');
    await act(async () => t!.unmount());
  });
});
