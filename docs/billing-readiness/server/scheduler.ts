import { scheduleDue, DISABLED_SCHEDULE, type SendChannel } from '../../../src/lib/billing-readiness';
export const scheduleConfiguration = { ...DISABLED_SCHEDULE };
export interface ScheduleDependencies {
  authenticateScheduler(credential: string): Promise<boolean>;
  config(): Promise<{ billingMode: string; invoiceEnabled: boolean; announcementEnabled: boolean; announcementHour: number | null; approvedScopeId: string | null }>;
  enqueueApprovedInvoices(servicePeriod: string): Promise<void>; // durable unique invoice slots
  enqueueAnnouncement(scopeId: string, day: string): Promise<void>; // unique business/env/realm/client/day/channel
}
export async function scheduledTick(deps: ScheduleDependencies, credential: string, now: Date) {
  if (!await deps.authenticateScheduler(credential)) throw new Error('unauthorized');
  const config = await deps.config();
  if (config.billingMode !== 'qbo') throw new Error('disabled');
  const due = scheduleDue(now, config);
  if (due.invoice) await deps.enqueueApprovedInvoices(due.dates.servicePeriod);
  if (due.announcement) {
    if (!config.approvedScopeId) throw new Error('announcement_scope_unapproved');
    await deps.enqueueAnnouncement(config.approvedScopeId, due.dates.sendDay);
  }
  return due;
}
export async function dispatchAnnouncement(deps: {
  authenticate(credential: string): Promise<boolean>;
  approvedRecipient(id: string): Promise<{ enabled: boolean; scopeApproved: boolean; channels: SendChannel[] } | null>;
  claim(id: string, channel: SendChannel): Promise<boolean>;
  send(id: string, channel: SendChannel): Promise<'sent' | 'failed' | 'unknown'>;
  record(id: string, channel: SendChannel, status: 'sent' | 'failed' | 'unknown'): Promise<void>;
}, credential: string, id: string) {
  if (!await deps.authenticate(credential)) throw new Error('unauthorized');
  const recipient = await deps.approvedRecipient(id); // server resolves STOP/consent/contact/scope
  if (!recipient?.enabled || !recipient.scopeApproved) throw new Error('disabled');
  for (const channel of recipient.channels) {
    const fresh = await deps.approvedRecipient(id);
    if (!fresh?.enabled || !fresh.scopeApproved || !fresh.channels.includes(channel)) throw new Error('stale_approval');
    if (!await deps.claim(id, channel)) continue;
    let status: 'sent' | 'failed' | 'unknown' = 'unknown';
    try { status = await deps.send(id, channel); } catch { /* require reconciliation */ }
    await deps.record(id, channel, status);
    if (status !== 'sent') return status;
  }
  return 'sent';
}
