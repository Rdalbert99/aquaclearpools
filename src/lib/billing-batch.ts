import type { Enrollment, Proposal, Snapshot } from './billing-readiness';
export interface BatchRow { client: { id: string; customer: string }; proposal: Proposal; blockers: string[]; snapshot: Snapshot | null; enrollment?: Enrollment | null }
/** Saved enrollment shown from the source record, independent of snapshot/provider readiness. */
export function enrollmentLabel(row: BatchRow): { state: 'on' | 'off' | 'unknown'; firstMonth: string | null } {
  const e = row.enrollment === undefined ? row.snapshot?.enrollment : row.enrollment;
  if (!e || e.revision < 1) return { state: 'unknown', firstMonth: null };
  return { state: e.enabled ? 'on' : 'off', firstMonth: e.firstServicePeriod };
}
/** Eligible = complete snapshot, no exclusion. Exclusions (hold, inactive, annual not due, before first month) stay separate. */
export function batchSummary(rows: BatchRow[]) {
  const eligible = rows.filter(r => r.snapshot && !r.proposal.excluded && !r.blockers.length);
  const excluded = rows.filter(r => !!r.proposal.excluded);
  const blocked = rows.filter(r => !r.proposal.excluded && !eligible.includes(r));
  const sum = (list: BatchRow[]) => list.reduce((t, r) => t + (r.proposal.amountCents ?? 0), 0);
  return { eligible, excluded, blocked, eligibleCents: sum(eligible), blockedCents: sum(blocked) };
}
/** Announcement audience = the reviewed eligible same-month invoice batch only. Never all active rows. */
export const announcementAudience = (rows: BatchRow[]) => batchSummary(rows).eligible.map(r => r.client.id);
