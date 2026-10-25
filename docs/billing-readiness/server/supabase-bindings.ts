import { snapshotCanonical, readinessRow, approvalIsFresh, type Enrollment, type Snapshot, type BillingClient, type AnnualConfig, type ExactMapping, type ProviderSetup } from '../../../src/lib/billing-readiness';
import type { EnrollmentScope } from '../../../src/lib/billing-enrollment';
import type { Authority, Store, Run, Approval, Policy, Actor } from './workflow';
import type { EnrollmentRepository } from './enrollment';
// Server-only parameterized gateway. This can wrap SDK rpc; NO arbitrary SQL or browser secrets.
export interface RpcGateway { rpc<T>(name: string, args: Record<string, unknown>): Promise<{ data: T | null; error: { message: string } | null }> }
export function concreteBillingBindings(deps: {
  db: RpcGateway; scope: Omit<EnrollmentScope, 'clientId'>;
  authenticate(credential: string): Promise<Actor | null>;
  policy(): Promise<Policy>;
  // Mandatory live source reader of current status/rate/annual/mapping/provider/consent/STOP.
  // Caller must implement it in server using protected, scoped parameterized queries.
  source(clientId: string): Promise<{ client: BillingClient; annual?: AnnualConfig; mapping?: ExactMapping; provider?: ProviderSetup; choice?: 'sms' | 'email' | 'both'; smsConsent: boolean; smsOptedOut: boolean; consentRevision: string }>;
}) {
  const scopeArgs = { _business: deps.scope.businessId, _environment: deps.scope.environment, _realm: deps.scope.realmId };
  async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T | null> {
    const result = await deps.db.rpc<T>(name, { ...scopeArgs, ...args });
    if (result.error) throw new Error('persistence_failed');
    return result.data;
  }
  function checkScope(s: Pick<Snapshot, 'businessId' | 'environment' | 'realmId'>) {
    if (s.businessId !== deps.scope.businessId || s.environment !== deps.scope.environment || s.realmId !== deps.scope.realmId) throw new Error('cross_business');
  }
  const repository: EnrollmentRepository = {
    clientBelongsToBusiness: async scope => { checkScope(scope); return (await rpc<boolean>('qbo_billing_client_in_scope', { _client: scope.clientId })) === true; },
    read: async scope => { checkScope(scope); return rpc<Enrollment>('qbo_billing_read_enrollment', { _client: scope.clientId }); },
    save: async (scope, input, actor) => {
      checkScope(scope);
      if (actor.kind !== 'admin' || actor.businessId !== scope.businessId) throw new Error('unauthorized');
      const data = await rpc<Enrollment>('qbo_billing_set_enrollment', { _client: scope.clientId, _enabled: input.enabled, _first: input.firstServicePeriod, _expected: input.expectedRevision, _actor: actor.id });
      if (!data) throw new Error('persistence_failed'); return data;
    },
  };
  const authority: Authority = {
    authenticate: deps.authenticate,
    policy: async business => { if (business !== deps.scope.businessId) throw new Error('cross_business'); return deps.policy(); },
    approval: id => rpc<Approval>('qbo_billing_read_approval', { _id: id }),
    current: async snapshot => {
      checkScope(snapshot);
      const [source, enrollment] = await Promise.all([deps.source(snapshot.clientId), repository.read({ ...deps.scope, clientId: snapshot.clientId })]);
      if (source.client.id !== snapshot.clientId) throw new Error('cross_business');
      const sendMonth = new Date(snapshot.sendAt).toISOString().slice(0, 7);
      return readinessRow(source.client, sendMonth, { ...deps.scope, ...source, enrollment }).snapshot;
    },
  };
  const store: Store = {
    claim: async (approval, actor) => {
      checkScope(approval.snapshot);
      if (actor.businessId !== deps.scope.businessId || !['admin', 'scheduler'].includes(actor.kind)) throw new Error('unauthorized');
      return rpc<Run>('qbo_billing_claim_scoped', { _approval: approval.id });
    },
    find: slot => rpc<Run>('qbo_billing_find_run', { _slot: slot }),
    update: async (id, patch) => { if (await rpc<boolean>('qbo_billing_update_run', { _id: id, _patch: patch }) !== true) throw new Error('persistence_failed'); },
    claimChannel: async (id, channel) => (await rpc<boolean>('qbo_billing_channel_scoped', { _id: id, _channel: channel })) === true,
  };
  return { repository, authority, store,
    claimResume: async (id: string) => (await rpc<boolean>('qbo_billing_resume_scoped', { _id: id })) === true,
    // Fresh source -> atomic SQL enrollment comparison and update of canonical config.
    synchronize: async (snapshot: Snapshot) => {
      checkScope(snapshot);
      if (!approvalIsFresh(snapshot, await authority.current(snapshot))) throw new Error('stale_approval');
      const revision = await rpc<number>('qbo_billing_sync_config', { _client: snapshot.clientId, _period: snapshot.servicePeriod, _snapshot: snapshot, _fingerprint: snapshotCanonical(snapshot), _enrollment_revision: snapshot.enrollment.revision });
      if (revision == null || revision < 1) throw new Error('persistence_failed');
      return revision;
    },
  };
}
