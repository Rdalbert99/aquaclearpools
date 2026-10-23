// Normalizes a read-only QuickBooks Invoice query into open-invoice rows (integer cents).
// Defensive: keeps only rows for the expected CustomerRef, positive balance, unique Id.

export interface OpenInvoice {
  id: string;
  docNumber: string | null;
  totalCents: number;
  balanceCents: number;
  dueDate: string | null;
  txnDate: string | null;
  paymentLink: string | null;
}

const cents = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
const isoDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const httpsLink = (v: unknown) => (typeof v === "string" && /^https:\/\/[^\s]+$/.test(v) ? v : null);

export const safeCustomerId = (v: unknown): string | null =>
  typeof v === "string" && /^[0-9]{1,20}$/.test(v) ? v : null;

export function openInvoicesQuery(customerId: string) {
  return `select * from Invoice where CustomerRef = '${customerId}' and Balance > '0' MAXRESULTS 100`;
}

/** Throws on malformed responses so callers report "balance unavailable", never $0. */
export function normalizeOpenInvoices(data: any, customerId: string): OpenInvoice[] {
  const qr = data?.QueryResponse;
  if (!qr || typeof qr !== "object") throw new Error("Malformed QuickBooks response");
  const rows = qr.Invoice ?? [];
  if (!Array.isArray(rows)) throw new Error("Malformed QuickBooks response");
  const seen = new Set<string>();
  const out: OpenInvoice[] = [];
  for (const r of rows) {
    const id = typeof r?.Id === "string" ? r.Id : null;
    if (!id || seen.has(id)) continue;
    if (String(r?.CustomerRef?.value ?? "") !== customerId) continue;
    const balanceCents = cents(r.Balance);
    const totalCents = cents(r.TotalAmt);
    if (!Number.isFinite(balanceCents) || !Number.isFinite(totalCents)) throw new Error("Malformed invoice amount");
    if (balanceCents <= 0) continue;
    seen.add(id);
    out.push({
      id, docNumber: typeof r.DocNumber === "string" ? r.DocNumber : null,
      totalCents, balanceCents, dueDate: isoDate(r.DueDate), txnDate: isoDate(r.TxnDate),
      paymentLink: httpsLink(r.InvoiceLink),
    });
  }
  return out.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}
