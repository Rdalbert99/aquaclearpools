// Pure helpers for the read-only QuickBooks test. No Deno/Node APIs so both
// the edge function and vitest can import it.

export interface QboInvoiceSummary {
  found: boolean;
  docNumber: string;
  invoiceId?: string;
  customerId?: string;
  customerName?: string;
  totalCents?: number;
  balanceCents?: number;
  paidCents?: number;
  status?: 'paid' | 'partially_paid' | 'open';
  txnDate?: string | null;
  dueDate?: string | null;
  linkedPaymentIds?: string[];
}

export const toCentsExact = (n: unknown): number => {
  const v = typeof n === 'number' ? n : parseFloat(String(n ?? ''));
  return Number.isFinite(v) ? Math.round(v * 100) : 0;
};

/** Only digits/letters/dashes allowed so the value can't break the QBO query. */
export function safeDocNumber(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  return /^[A-Za-z0-9-]{1,21}$/.test(s) ? s : null;
}

export function summarizeInvoice(docNumber: string, queryResponse: any): QboInvoiceSummary {
  const inv = queryResponse?.QueryResponse?.Invoice?.[0];
  if (!inv) return { found: false, docNumber };
  const totalCents = toCentsExact(inv.TotalAmt);
  const balanceCents = toCentsExact(inv.Balance);
  const paidCents = Math.max(0, totalCents - balanceCents);
  const status = balanceCents <= 0 ? 'paid' : paidCents > 0 ? 'partially_paid' : 'open';
  const linkedPaymentIds = (inv.LinkedTxn ?? [])
    .filter((t: any) => t?.TxnType === 'Payment')
    .map((t: any) => String(t.TxnId));
  return {
    found: true,
    docNumber,
    invoiceId: String(inv.Id),
    customerId: inv.CustomerRef?.value != null ? String(inv.CustomerRef.value) : undefined,
    customerName: inv.CustomerRef?.name,
    totalCents,
    balanceCents,
    paidCents,
    status,
    txnDate: inv.TxnDate ?? null,
    dueDate: inv.DueDate ?? null,
    linkedPaymentIds,
  };
}

const ALLOWED_RETURN_HOSTS = [/^getaquaclear\.com$/, /^www\.getaquaclear\.com$/, /\.lovable\.app$/, /\.lovableproject\.com$/, /^localhost$/];

export function isAllowedReturnUrl(raw: unknown): boolean {
  try {
    const u = new URL(String(raw));
    if (u.protocol !== 'https:' && u.hostname !== 'localhost') return false;
    return ALLOWED_RETURN_HOSTS.some((r) => r.test(u.hostname));
  } catch {
    return false;
  }
}
