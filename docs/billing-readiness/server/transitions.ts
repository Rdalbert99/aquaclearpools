import type { Run, SyncState, ChannelState } from './workflow';
export function legalRunTransition(run: Run, patch: { state?: SyncState; providerInvoiceId?: string; code?: string; channel?: 'sms' | 'email'; channelState?: ChannelState }) {
  const target = patch.state ?? run.state;
  if (run.state === 'complete') return false;
  if (patch.providerInvoiceId && run.providerInvoiceId && patch.providerInvoiceId !== run.providerInvoiceId) return false;
  if (patch.channel && (run.channels[patch.channel] !== 'sending' || !['sent', 'failed', 'unknown'].includes(patch.channelState ?? ''))) return false;
  if (target === 'complete' && (!run.providerInvoiceId || !Object.keys(run.channels).length || Object.values(run.channels).some(s => s !== 'sent'))) return false;
  if (target === run.state) return true;
  if (run.state === 'claimed') return ['reconcile', 'created', 'blocked', 'complete'].includes(target);
  if (run.state === 'reconcile') return target === 'created' && !run.providerInvoiceId && !!patch.providerInvoiceId && patch.code === 'invoice_recorded';
  if (run.state === 'created') return ['blocked', 'reconcile', 'complete'].includes(target);
  return run.state === 'blocked' && target === 'reconcile';
}
// Resume uses its separate atomic RPC to transition blocked/created -> claimed, never this updater.
