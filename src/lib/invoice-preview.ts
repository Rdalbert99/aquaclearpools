// Read-only preview gate. Reuse the provider's paid/manual-inclusive collision check;
// never infer service coverage from an open balance, amount, or due date alone.
export type ExistingInvoiceCheck =
  | { status: 'clear'; exact: { id: string }[] }
  | { status: 'ambiguous'; exact: { id: string }[] }
  | { status: 'unavailable'; exact: [] };

export function invoicePreviewGate<T extends {
  proposal: { excluded: string | null }; blockers: string[]; snapshot: unknown;
}>(row: T, check: ExistingInvoiceCheck): Omit<T, 'proposal' | 'snapshot' | 'blockers'> & {
  proposal: T['proposal'];
  snapshot: T['snapshot'] | null; blockers: string[]; existingInvoiceCheck: ExistingInvoiceCheck;
} {
  const reason = check.status === 'unavailable' ? 'Existing QuickBooks invoice check unavailable — no new proposal'
    : check.status === 'ambiguous' || check.exact.length > 1 ? 'Existing/manual QuickBooks invoice needs review — no new proposal'
    : check.exact.length === 1 ? `Already invoiced for this service coverage — QuickBooks #${check.exact[0].id}` : null;
  return { ...row, existingInvoiceCheck: check,
    proposal: { ...row.proposal, excluded: row.proposal.excluded ?? reason } as T['proposal'],
    blockers: reason ? [...new Set([...row.blockers, reason])] : row.blockers,
    snapshot: reason ? null : row.snapshot as T['snapshot'] };
}
