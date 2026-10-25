import { readinessRow, type AnnualConfig, type BillingClient, type Enrollment, type ExactMapping, type ProviderSetup } from '../../../src/lib/billing-readiness';
import type { RpcGateway } from './supabase-bindings';
import type { EnrollmentScope } from '../../../src/lib/billing-enrollment';
export interface SourceRecord {
  client: BillingClient; annual?: AnnualConfig; mapping?: ExactMapping; provider?: ProviderSetup;
  enrollment: Enrollment | null; choice?: 'sms' | 'email' | 'both'; smsConsent: boolean;
  smsOptedOut: boolean; consentRevision: string;
}
export function sourceAuthority(db: RpcGateway, scope: Omit<EnrollmentScope, 'clientId'>) {
  const args = { _business: scope.businessId, _environment: scope.environment, _realm: scope.realmId };
  async function source(clientId: string) {
    const result = await db.rpc<SourceRecord>('qbo_billing_source', { ...args, _client: clientId });
    if (result.error || !result.data || result.data.client.id !== clientId) throw new Error('source_unavailable');
    return result.data;
  }
  return { source, preview: async (clientId: string, sendMonth: string) => {
    const record = await source(clientId);
    // Saved enrollment is returned independently of snapshot/provider readiness.
    return { ...readinessRow(record.client, sendMonth, { ...scope, ...record }), enrollment: record.enrollment };
  } };
}
