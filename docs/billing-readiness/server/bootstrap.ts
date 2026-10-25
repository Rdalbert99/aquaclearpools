import { OWNER_IDS, isActiveClient } from '../../../src/lib/billing-readiness';
// This is a reviewed manifest contract, NOT a live query or auto-on default.
export interface ReviewedCohort {
  asOf: string; reviewedBy: string; approved: boolean;
  members: { clientId: string; statusAtCapture: string; createdAt: string }[];
}
export const bootstrapReview = {
  approved: false,
  asOf: '2026-10-25T12:32:45Z',
  reviewedBy: null,
  firstServicePeriod: '2026-11',
  knownIdentityOverrides: [
    { clientId: OWNER_IDS.laken, enabled: false, reason: 'owner_hold' },
    { clientId: OWNER_IDS.peggy, enabled: true, annualAmountCents: 300000, renewalMonth: 11, channel: 'sms', confirmed: true },
    { clientId: OWNER_IDS.shelby, enabled: true, annualAmountCents: null, renewalMonth: null, confirmed: false },
    { clientId: OWNER_IDS.jennifer, enabled: true, annualAmountCents: null, renewalMonth: null, confirmed: false },
  ],
  // Exact frozen owner-provided Active cohort; application remains separately unapproved.
  members: ["031f318d-5df5-4295-aba2-415089197496", "067f0f4b-99ef-44bd-b94b-0a594da7c484", "1445fb68-640b-48fa-bdc1-e951f4c677e2", "15d8a7d0-769c-4b46-954a-e23f3f07c5d8", "1db5a625-bef6-40d5-bf01-7ba1c0ccd979", "208cdcbc-375c-495f-8838-0e1f2003038c", "3e938a8a-74c2-4ba2-a163-ce2e870b85a7", "472db2d2-1095-421c-a13c-bc8d57880da9", "48b93a78-2b8e-465e-8026-b1482295c3e7", "48cc0b91-a675-48df-89c1-8a12c9550efb", "4927c927-8011-48f1-b703-db2e0e9e86ae", "5cc2d5fc-7cac-438a-bd70-5c3fd2a1b1ac", "6305a08e-8804-4d83-bfcc-a5d2d00a353c", "66aacb7e-8b5a-4039-9032-17bb3967bffc", "6d228b42-7306-467f-9a9d-89f31ad4f599", "763a94b0-a4c7-4f57-90ca-0145abad7fe3", "88fed2de-b36a-479b-ae46-a790832236cd", "89a51663-dba0-4e32-b93f-1a138c1b123a", "9617d397-e235-4e58-b6d3-81e7caeb7763", "9a8f6dce-bd90-4995-aa91-50664e45d81b", "9f72bc8d-abc7-4b93-8d92-d747688fdadd", "a434582f-342f-442f-959c-b9225b9acac4", "a44de5db-11fc-43b6-8e73-5d50ae32eb87", "ae37e824-514d-4af3-beed-47c66428e838", "b5bbd703-cc0c-436e-85a7-0dba88891347", "b9e01be9-9b5c-40bf-ad56-31b481aa298c", "cc6853a2-9707-4b5c-ba28-c580d250eb80", "d53635f4-29b1-401a-b27a-4807a5bd0f69", "da381bf3-d136-4431-9170-50d3884fea50", "db4d0008-fa65-4bbe-8bba-99c1d32fd08e", "dcee3013-3d67-4ae3-a3ec-61b94e98fb84", "dcfb296f-84e1-4af7-a849-0f33f3437ebe", "ece13793-1be9-462d-a613-a339ba51f1ba"],
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
