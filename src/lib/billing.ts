// Billing helpers. All money is stored as integer cents.

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void';
export type LineKind = 'service' | 'chemical' | 'repair' | 'other';

export const LINE_KINDS: { value: LineKind; label: string }[] = [
  { value: 'service', label: 'Service' },
  { value: 'chemical', label: 'Chemicals' },
  { value: 'repair', label: 'Repair / parts' },
  { value: 'other', label: 'Other' },
];

export const toCents = (dollars: string | number): number => {
  const n = typeof dollars === 'number' ? dollars : parseFloat(String(dollars).replace(/[$,\s]/g, ''));
  return isFinite(n) ? Math.round(n * 100) : 0;
};

export const fromCents = (cents: number | null | undefined): string =>
  ((cents ?? 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export const centsToInput = (cents: number | null | undefined): string =>
  cents ? (cents / 100).toFixed(2) : '';

export const lineAmountCents = (qty: string | number, unitCents: number): number => {
  const q = typeof qty === 'number' ? qty : parseFloat(qty);
  return isFinite(q) ? Math.round(q * unitCents) : 0;
};

/** Spread a payment across invoices, oldest first, never exceeding each balance. */
export function autoAllocate(
  amountCents: number,
  invoices: { id: string; balance_cents: number }[],
): Record<string, number> {
  let left = amountCents;
  const out: Record<string, number> = {};
  for (const inv of invoices) {
    if (left <= 0) break;
    const take = Math.min(left, inv.balance_cents);
    if (take > 0) { out[inv.id] = take; left -= take; }
  }
  return out;
}

export const monthRange = (ym: string): { start: string; end: string; label: string } => {
  const [y, m] = ym.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: iso(start), end: iso(end), label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) };
};
