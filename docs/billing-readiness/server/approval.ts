import { approvalIsFresh, snapshotCanonical, type Snapshot } from '../../../src/lib/billing-readiness';
import type { Actor, Approval } from './workflow';
// Safe save contract: browser supplies client/batch IDs and reviewed fingerprint only.
// Transaction implementation must lock authoritative client/config/consent/mapping rows,
// recompute the proposal, invalidate old revision, and insert immutable approval atomically.
export async function saveReviewedApproval(deps: {
  authenticate(credential: string): Promise<Actor | null>;
  transact(input: { actor: Actor; clientId: string; sendMonth: string }, review: (fresh: Snapshot | null) => Snapshot): Promise<Approval>;
}, credential: string, input: { clientId: string; sendMonth: string; reviewed: Snapshot }) {
  const actor = await deps.authenticate(credential);
  if (!actor || actor.kind !== 'admin' || actor.businessId !== input.reviewed.businessId || input.reviewed.clientId !== input.clientId) throw new Error('unauthorized');
  return deps.transact({ actor, clientId: input.clientId, sendMonth: input.sendMonth }, fresh => {
    if (!fresh || !approvalIsFresh(input.reviewed, fresh)) throw new Error('stale_approval');
    if (snapshotCanonical(fresh) !== snapshotCanonical(input.reviewed)) throw new Error('stale_approval');
    return fresh; // store server value, never the client's submitted rate/snapshot
  }); // Failures propagate to caller; no success toast on a failed save.
}
