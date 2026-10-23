// Account balance shown NEXT TO a new service invoice. The new invoice amount is never changed:
// earlier unpaid QuickBooks balances are listed separately and only added into a display total.
import type { OpenInvoice } from '../../supabase/functions/_shared/qbo-balance';
export type { OpenInvoice };

export type BalanceLookup =
  | { status: 'ok'; invoices: OpenInvoice[] }
  | { status: 'unavailable'; reason: string };

export interface AccountSummary {
  newInvoiceCents: number;
  available: boolean;
  reason: string | null;
  previous: (OpenInvoice & { pastDue: boolean })[];
  previousCents: number | null;
  totalCents: number | null;
  pastDue: boolean;
}

/**
 * @param newInvoiceQboId if the new invoice already exists in QuickBooks, its Id — excluded from "previous"
 *   so it is never counted twice.
 */
export function accountSummary(newInvoiceCents: number, lookup: BalanceLookup, todayIso: string, newInvoiceQboId?: string | null): AccountSummary {
  if (lookup.status !== 'ok') {
    return { newInvoiceCents, available: false, reason: lookup.reason, previous: [], previousCents: null, totalCents: null, pastDue: false };
  }
  const seen = new Set<string>();
  const previous = lookup.invoices
    .filter((i) => i.balanceCents > 0 && i.id !== newInvoiceQboId && !seen.has(i.id) && seen.add(i.id))
    .map((i) => ({ ...i, pastDue: !!i.dueDate && i.dueDate < todayIso }));
  const previousCents = previous.reduce((s, i) => s + i.balanceCents, 0);
  return {
    newInvoiceCents, available: true, reason: null, previous, previousCents,
    totalCents: newInvoiceCents + previousCents, pastDue: previous.some((i) => i.pastDue),
  };
}

const usd = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** Extra lines appended to an invoice notification draft. Empty when there is nothing earlier to show. */
export function balanceDraftLines(s: AccountSummary): string {
  if (!s.available) return '';
  if (!s.previous.length) return '';
  const list = s.previous.map((i) => `#${i.docNumber ?? i.id} ${usd(i.balanceCents)}${i.pastDue ? ' (past due)' : ''}`).join(', ');
  return ` Earlier unpaid: ${list}. Account total due: ${usd(s.totalCents!)}.`;
}
