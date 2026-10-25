import { OWNER_IDS, isActiveClient } from '../../../src/lib/billing-readiness';
// This is a reviewed manifest contract, NOT a live query or auto-on default.
export interface ReviewedCohort {
  asOf: string; reviewedBy: string; approved: boolean;
  members: { clientId: string; statusAtCapture: string; createdAt: string }[];
}
export const bootstrapReview = {
  approved: false,
  asOf: null,
  reviewedBy: null,
  firstServicePeriod: '2026-11',
  knownIdentityOverrides: [
    { clientId: OWNER_IDS.laken, enabled: false, reason: 'owner_hold' },
    { clientId: OWNER_IDS.peggy, enabled: true, annualAmountCents: 300000, renewalMonth: 11, channel: 'sms', confirmed: true },
    { clientId: OWNER_IDS.shelby, enabled: true, annualAmountCents: null, renewalMonth: null, confirmed: false },
    { clientId: OWNER_IDS.jennifer, enabled: true, annualAmountCents: null, renewalMonth: null, confirmed: false },
  ],
  // Full frozen Active-client identity list unavailable without prohibited live access.
  members: [],
};
export function reviewedBootstrap(cohort: ReviewedCohort) {
  if (!cohort.approved || !cohort.reviewedBy || !Number.isFinite(Date.parse(cohort.asOf))) throw new Error('cohort_review_required');
  const seen = new Set<string>();
  return cohort.members.filter(member => {
    if (seen.has(member.clientId)) throw new Error('duplicate_cohort_identity');
    seen.add(member.clientId);
    return isActiveClient(member.statusAtCapture) && Number.isFinite(Date.parse(member.createdAt)) && Date.parse(member.createdAt) <= Date.parse(cohort.asOf);
  }).map(member => ({ clientId: member.clientId, enabled: member.clientId !== OWNER_IDS.laken, firstServicePeriod: '2026-11' }));
}
// No function applies this manifest. Activation must review frozen IDs and prepare a separate
// audited migration/transaction; ON CONFLICT DO NOTHING must never overwrite later owner choices.
