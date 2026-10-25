// PREPARED ONLY. Not an Edge Function entrypoint; never imported by the browser.
// No network, environment access, global credentials, or default provider/store adapter.
import { approvalIsFresh, executionKey, invoiceSlot, snapshotCanonical, type Snapshot, type SendChannel } from '../../../src/lib/billing-readiness';
import { sanitize } from '../../../supabase/functions/_shared/qbo-oauth';

export type SyncState = 'claimed' | 'created' | 'complete' | 'blocked' | 'reconcile';
export type ChannelState = 'pending' | 'sending' | 'sent' | 'failed' | 'unknown';
export interface Run {
  id: string; auditId: string; snapshot: Snapshot; state: SyncState; requestId: string;
  providerInvoiceId: string | null; channels: Partial<Record<SendChannel, ChannelState>>;
}
export interface Policy {
  billingMode: string; invoiceEnabled: boolean; announcementEnabled: boolean;
  environment: Snapshot['environment']; realmId: string; businessId: string;
  migrationVerified: boolean; providerVerified: boolean; deploymentVerified: boolean;
}
export interface Actor { id: string; businessId: string; kind: 'admin' | 'scheduler' }
export interface Approval { id: string; snapshot: Snapshot; approvedBy: string; approvedAt: string; fingerprint: string }
export interface Authority {
  // Implement with validated Supabase JWT + protected business role lookup, or constant-time
  // dedicated scheduler secret + scoped allow-list. Never accept a role from request body.
  authenticate(credential: string): Promise<Actor | null>;
  policy(businessId: string): Promise<Policy>;
  approval(approvalId: string): Promise<Approval | null>;
  // Read client status, rate / confirmed annual config, contacts, mapping, setup, consent,
  // opt-outs and current realm SERVER SIDE; recompute readinessRow. Read errors throw.
  current(snapshot: Snapshot): Promise<Snapshot | null>;
}
export interface Store {
  // Transaction MUST: lock canonical config/client snapshot, compare expected fingerprint,
  // verify immutable server approval, INSERT unique slot and unique requestId, then commit.
  // Conflict returns null, NEVER grants a second worker the existing claim.
  claim(approval: Approval, actor: Actor): Promise<Run | null>;
  find(slot: string): Promise<Run | null>;
  update(id: string, patch: { state?: SyncState; providerInvoiceId?: string; channel?: SendChannel; channelState?: ChannelState; code?: string; auditId?: string }): Promise<void>;
  // CAS pending/failed -> sending; sending/sent/unknown cannot be automatically retried.
  claimChannel(id: string, channel: SendChannel): Promise<boolean>;
}
export interface ProviderInvoice { id: string; customerId: string; amountCents: number; dueDate: string; serviceStart: string; serviceEnd: string; frequency: Snapshot['frequency'] }
export interface InvoicePayload {
  CustomerRef: { value: string }; TxnDate: string; DueDate: string; PrivateNote: string;
  GlobalTaxCalculation: 'NotApplicable' | 'TaxInclusive' | 'TaxExcluded';
  Line: { Amount: number; Description: string; DetailType: 'SalesItemLineDetail'; SalesItemLineDetail: { ItemRef: { value: string }; Qty: number; UnitPrice: number; TaxCodeRef: { value: string } } }[];
}
export function invoicePayload(s: Snapshot): InvoicePayload {
  if (!Number.isSafeInteger(s.amountCents) || s.amountCents <= 0) throw new Error('invalid_amount');
  return { CustomerRef: { value: s.customerId }, TxnDate: s.sendAt.slice(0, 10), DueDate: s.dueDate,
    PrivateNote: `Aqua Clear service ${s.serviceStart} through ${s.serviceEnd}; ${s.frequency}`,
    GlobalTaxCalculation: s.provider.taxMode === 'non_taxable' ? 'NotApplicable' : s.provider.taxMode === 'tax_inclusive' ? 'TaxInclusive' : 'TaxExcluded',
    Line: [{ Amount: s.amountCents / 100, Description: `Pool service ${s.serviceStart} through ${s.serviceEnd}`, DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: { ItemRef: { value: s.provider.itemId }, Qty: 1, UnitPrice: s.amountCents / 100, TaxCodeRef: { value: s.provider.taxCode } } }] };
}
export interface Provider {
  // Must page ALL relevant invoices (including paid/manual) for exact customer and coverage.
  // Dates/names/amount alone are candidates, never proof; ambiguous relevance blocks creation.
  existing(s: Snapshot): Promise<{ status: 'clear' | 'ambiguous'; exact: ProviderInvoice[] }>;
  // Verify item active, income account, customer and company/tax settings in SAME realm.
  verifySetup(s: Snapshot): Promise<boolean>;
  // Read current QBO Balance separately. Failure is NOT zero and blocks execution/delivery.
  balances(s: Snapshot): Promise<{ available: boolean }>;
  create(s: Snapshot, payload: InvoicePayload, stableRequestId: string): Promise<ProviderInvoice>;
  // Non-retrying write. Use provider-supported idempotency only when documented/verified.
  deliver(s: Snapshot, invoiceId: string, channel: SendChannel, key: string): Promise<'sent' | 'failed' | 'unknown'>;
}
const matches = (i: ProviderInvoice, s: Snapshot) => i.customerId === s.customerId && i.amountCents === s.amountCents && i.dueDate === s.dueDate && i.serviceStart === s.serviceStart && i.serviceEnd === s.serviceEnd && i.frequency === s.frequency;
async function authorized(auth: Authority, credential: string, approvalId: string) {
  const actor = await auth.authenticate(credential);
  if (!actor) throw new Error('unauthorized');
  const approval = await auth.approval(approvalId);
  if (!approval || approval.snapshot.businessId !== actor.businessId) throw new Error('unauthorized');
  const policy = await auth.policy(actor.businessId);
  const s = approval.snapshot;
  if (policy.billingMode !== 'qbo' || !policy.invoiceEnabled || !policy.migrationVerified || !policy.providerVerified || !policy.deploymentVerified) throw new Error('disabled');
  if (policy.environment !== s.environment || policy.realmId !== s.realmId || policy.businessId !== s.businessId) throw new Error('cross_realm');
  if (!approval.approvedBy || !approval.approvedAt || approval.fingerprint !== snapshotCanonical(s)) throw new Error('invalid_approval');
  if (!approvalIsFresh(s, await auth.current(s))) throw new Error('stale_approval');
  return { actor, approval };
}
/** Only accepts an approval ID; amounts/channels/realm cannot be supplied by browser. */
export async function executeInvoice(deps: { authority: Authority; store: Store; provider: Provider }, credential: string, approvalId: string) {
  const { authority: auth, store, provider } = deps;
  const { actor, approval } = await authorized(auth, credential, approvalId);
  const run = await store.claim(approval, actor);
  if (!run) return { state: 'duplicate' as const, existing: await store.find(invoiceSlot(approval.snapshot)) };
  const s = run.snapshot;
  try {
    if (!approvalIsFresh(s, await auth.current(s))) throw new Error('stale_approval');
    if (!await provider.verifySetup(s)) throw new Error('provider_setup');
    if (!(await provider.balances(s)).available) throw new Error('balance_unavailable');
    const lookup = await provider.existing(s);
    if (lookup.status === 'ambiguous' || lookup.exact.length > 1 || lookup.exact.some(i => !matches(i, s))) throw new Error('existing_invoice_ambiguous');
    let invoice = lookup.exact[0];
    if (!invoice) {
      // Fresh authority and policy immediately before every external effect.
      await authorized(auth, credential, approvalId);
      // Durable 'reconcile' is persisted BEFORE request. Crash/timeout cannot auto-recreate.
      await store.update(run.id, { state: 'reconcile', code: 'create_in_flight' });
      invoice = await provider.create(s, invoicePayload(s), run.requestId);
      if (!matches(invoice, s)) throw new Error('provider_result_mismatch');
    }
    await store.update(run.id, { state: 'created', providerInvoiceId: invoice.id, code: 'invoice_recorded' });
    for (const channel of s.channels) {
      await authorized(auth, credential, approvalId); // STOP, contact and consent changes invalidate approval.
      if (!await store.claimChannel(run.id, channel)) continue;
      let outcome: 'sent' | 'failed' | 'unknown' = 'unknown';
      try { outcome = await provider.deliver(s, invoice.id, channel, `${executionKey(s)}:${channel}`); }
      catch { outcome = 'unknown'; }
      await store.update(run.id, { channel, channelState: outcome, code: `delivery_${outcome}` });
      if (outcome !== 'sent') {
        await store.update(run.id, { state: outcome === 'unknown' ? 'reconcile' : 'blocked' });
        return { state: outcome === 'unknown' ? 'reconcile' : 'blocked', invoiceId: invoice.id, auditId: run.auditId };
      }
    }
    await store.update(run.id, { state: 'complete' });
    return { state: 'complete', invoiceId: invoice.id, auditId: run.auditId };
  } catch (error) {
    // No raw provider details/credentials/PII. Crash after write remains permanently uncertain.
    const current = await store.find(invoiceSlot(s));
    const state = current?.state === 'reconcile' || current?.providerInvoiceId ? 'reconcile' : 'blocked';
    const code = error instanceof Error && /^[a-z_]+$/.test(error.message) ? sanitize(error.message) : 'execution_failed';
    await store.update(run.id, { state, code });
    return { state, auditId: run.auditId };
  }
}
// Explicit operator reconciliation only: never recreate or resend an unknown attempt.
// Pending/definitively failed channel resumption must reuse the SAME run/provider ID;
// caller supplies no invoice ID, and the store needs a single-worker resume claim.
export async function resumeDelivery(deps: { authority: Authority; store: Store; provider: Provider; claimResume(id: string): Promise<boolean> }, credential: string, approvalId: string) {
  const { approval } = await authorized(deps.authority, credential, approvalId);
  const run = await deps.store.find(invoiceSlot(approval.snapshot));
  if (!run?.providerInvoiceId || !['created', 'blocked'].includes(run.state) || Object.values(run.channels).some(s => s === 'unknown' || s === 'sending')) throw new Error('reconciliation_required');
  if (!await deps.claimResume(run.id)) return 'duplicate';
  if (!(await deps.provider.balances(run.snapshot)).available) throw new Error('balance_unavailable');
  for (const channel of run.snapshot.channels) {
    await authorized(deps.authority, credential, approvalId);
    if (!await deps.store.claimChannel(run.id, channel)) continue;
    let outcome: 'sent' | 'failed' | 'unknown' = 'unknown';
    try { outcome = await deps.provider.deliver(run.snapshot, run.providerInvoiceId, channel, `${executionKey(run.snapshot)}:${channel}`); } catch { /* uncertain */ }
    await deps.store.update(run.id, { channel, channelState: outcome, state: outcome === 'sent' ? 'created' : outcome === 'unknown' ? 'reconcile' : 'blocked' });
    if (outcome !== 'sent') return outcome;
  }
  await deps.store.update(run.id, { state: 'complete' });
  return 'complete';
}
