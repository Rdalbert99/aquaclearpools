import { approvalIsFresh, chicagoDate, datesForServiceMonth } from '../../../src/lib/billing-readiness';
import type { Approval, Authority } from './workflow';
// Scheduler adapter must scan a frozen scope's saved approvals, never enroll from Active status.
// Atomic claim remains the final guard against disable/claim races.
export async function enqueueEnrolledApprovals(deps: {
  authority: Authority; approvals(servicePeriod: string): Promise<Approval[]>;
  enqueue(approvalId: string): Promise<void>; // unique approval/run slot durable enqueue
}, servicePeriod: string, now: Date) {
  const dates = datesForServiceMonth(servicePeriod);
  if (chicagoDate(now) !== dates.sendDay || now.getTime() < Date.parse(dates.sendAt)) throw new Error('send_day_review_required');
  let eligible = 0;
  for (const approval of await deps.approvals(servicePeriod)) {
    if (approval.snapshot.servicePeriod !== servicePeriod) continue;
    const policy = await deps.authority.policy(approval.snapshot.businessId);
    if (policy.billingMode !== 'qbo' || !policy.invoiceEnabled || !policy.migrationVerified || !policy.providerVerified || !policy.deploymentVerified) continue;
    if (policy.environment !== approval.snapshot.environment || policy.realmId !== approval.snapshot.realmId) continue;
    if (!approvalIsFresh(approval.snapshot, await deps.authority.current(approval.snapshot))) continue;
    await deps.enqueue(approval.id); eligible++;
  }
  return eligible;
}
