import { chicagoToUtc, finalWeekMonday, resolveInvoiceChannels, type InvoiceChannel, type SendChannel } from './invoice-delivery';

export const OWNER_IDS = {
  laken: '15d8a7d0-769c-4b46-954a-e23f3f07c5d8',
  peggy: '6d228b42-7306-467f-9a9d-89f31ad4f599',
  shelby: '208cdcbc-375c-495f-8838-0e1f2003038c',
  jennifer: '9a8f6dce-bd90-4995-aa91-50664e45d81b',
} as const;
export const READINESS_GATES = [
  'Unapplied orchestration schema and atomic store adapter',
  'Server deployment and server-side administrator / scheduler authorization',
  'Exact business + environment + realm customer mappings verified',
  'QuickBooks service ItemRef, income account and explicit tax setup verified',
  'Annual amounts and renewal months reconciled; Peggy amount reviewed',
  'Saved immutable approvals and fresh rates, consent, STOP and balance checks',
  'Email / SMS adapters and uncertain-outcome reconciliation verified in isolation',
  'Separate activation approval; billing mode and both schedules remain off',
] as const;
const normalized = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
export const isActiveClient = (status: string | null | undefined) => normalized(status) === 'active';
export function chicagoDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (key: string) => parts.find(p => p.type === key)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export const initialSendMonth = (now = new Date()) => chicagoDate(now).slice(0, 7);
export function parseMonth(period: string): [number, number] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Choose a valid month');
  const [year, month] = period.split('-').map(Number);
  if (year < 1900 || year > 9998) throw new Error('Month out of range');
  return [year, month];
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
export function batchDates(sendMonth: string) {
  const [year, month] = parseMonth(sendMonth);
  const serviceStart = iso(new Date(Date.UTC(year, month, 1)));
  const serviceEnd = iso(new Date(Date.UTC(year, month + 1, 0)));
  const sendDay = finalWeekMonday(year, month);
  return { sendMonth, sendDay, sendAt: chicagoToUtc(sendDay, 12).toISOString(), servicePeriod: serviceStart.slice(0, 7), serviceStart, serviceEnd, dueDate: serviceStart };
}
export interface AnnualConfig {
  frequency: 'annual'; renewalMonth: number | null; renewalConfirmed: boolean;
  amountCents: number | null; amountConfirmed: boolean; revision: string;
  channel?: InvoiceChannel;
}
export interface BillingClient {
  id: string; customer: string; status: string | null; service_rate: number | null;
  contact_phone?: string | null; contact_email?: string | null; notification_method?: string | null;
}
export interface Proposal {
  amountCents: number | null; frequency: 'monthly' | 'annual'; channelOverride: InvoiceChannel | null;
  excluded: string | null; blockers: string[]; note: string | null;
  serviceStart: string; serviceEnd: string; dueDate: string; configRevision: string;
}
function ownerIdentity(id: string, name: string): keyof typeof OWNER_IDS | null {
  const found = Object.entries(OWNER_IDS).find(([, value]) => value === id)?.[0];
  if (found) return found as keyof typeof OWNER_IDS;
  // Exact fallback is restrictive ONLY: never authorizes an annual charge by name.
  const n = normalized(name);
  if (['laken ford ramey', 'laken ramey'].includes(n)) return 'laken';
  return null;
}
export function proposeForClient(client: BillingClient, servicePeriod: string, annual?: AnnualConfig): Proposal {
  const [year, month] = parseMonth(servicePeriod);
  const serviceStart = `${servicePeriod}-01`;
  const base: Proposal = { amountCents: null, frequency: 'monthly', channelOverride: null, excluded: null,
    blockers: [], note: null, serviceStart, serviceEnd: iso(new Date(Date.UTC(year, month, 0))), dueDate: serviceStart, configRevision: annual?.revision ?? 'monthly-v1' };
  if (!isActiveClient(client.status)) return { ...base, excluded: 'Inactive or suspended' };
  const owner = ownerIdentity(client.id, client.customer);
  if (owner === 'laken') return { ...base, amountCents: client.service_rate == null ? null : Math.round(client.service_rate * 100), excluded: 'Owner hold — do not invoice until released' };
  const prepaid = owner === 'shelby' || owner === 'jennifer';
  // A known annual name without its stable identity can only block, never override a rate.
  const ambiguousAnnual = !owner && ['peggy mcquarter', 'shelby thames', 'jennifer robinson'].includes(normalized(client.customer));
  if (ambiguousAnnual) return { ...base, frequency: 'annual', blockers: ['Confirm stable annual customer identity'], excluded: 'Annual prepaid — identity needs review' };
  const config = annual ?? (owner === 'peggy' ? {
    frequency: 'annual' as const, renewalMonth: 11, renewalConfirmed: true,
    amountCents: 300000, amountConfirmed: false, revision: 'owner-2026-10-25-peggy-proposal', channel: 'sms' as const,
  } : prepaid ? { frequency: 'annual' as const, renewalMonth: null, renewalConfirmed: false, amountCents: null, amountConfirmed: false, revision: 'prepaid-unreconciled' } : undefined);
  if (config) {
    const p = { ...base, frequency: 'annual' as const, channelOverride: config.channel ?? null, configRevision: config.revision, amountCents: config.amountCents };
    if (!config.renewalConfirmed || !Number.isInteger(config.renewalMonth) || Number(config.renewalMonth) < 1 || Number(config.renewalMonth) > 12)
      p.blockers.push('Confirm annual renewal month');
    if (!config.amountConfirmed || !Number.isSafeInteger(config.amountCents) || Number(config.amountCents) <= 0)
      p.blockers.push('Confirm annual amount (never monthly rate × 12)');
    if (p.blockers.length && prepaid) p.excluded = 'Annual prepaid — preserve exclusion until reconciled';
    if (config.renewalConfirmed && config.renewalMonth !== month) p.excluded = 'Annual non-renewal month — no monthly invoice';
    p.serviceEnd = iso(new Date(Date.UTC(year + 1, month - 1, 0)));
    p.note = owner === 'peggy' ? 'November renewal confirmed; existing $3,000 text-only amount is a reviewable proposal' : 'Annual coverage; no additional monthly bill';
    return p;
  }
  if (client.service_rate == null || !Number.isFinite(client.service_rate) || client.service_rate <= 0) base.blockers.push('Confirm monthly rate');
  else base.amountCents = Math.round(client.service_rate * 100);
  return base;
}
/** Compatibility without substring charging; use stable-identity API for new code. */
export function proposeInvoice(name: string, monthlyRate: number | null | undefined, servicePeriod: string): Proposal {
  return proposeForClient({ id: '', customer: name, status: 'Active', service_rate: monthlyRate ?? null }, servicePeriod);
}
export interface ExactMapping {
  businessId: string; environment: 'sandbox' | 'production'; realmId: string; clientId: string;
  customerId: string; verified: boolean; revision: string;
}
export interface ProviderSetup {
  itemId: string; incomeAccountId: string; taxCode: string; taxMode: 'non_taxable' | 'tax_inclusive' | 'tax_exclusive';
  verified: boolean; revision: string;
}
export interface Snapshot {
  businessId: string; environment: 'sandbox' | 'production'; realmId: string; clientId: string; customerId: string;
  amountCents: number; frequency: 'monthly' | 'annual'; servicePeriod: string; serviceStart: string;
  serviceEnd: string; dueDate: string; sendAt: string; channels: SendChannel[];
  configRevision: string; mappingRevision: string; provider: ProviderSetup;
  contactPhone: string | null; contactEmail: string | null; consentRevision: string;
}
export const validProviderId = (s: string) => /^[0-9]{1,20}$/.test(s);
export function readinessRow(client: BillingClient, sendMonth: string, context: {
  businessId: string; environment: 'sandbox' | 'production'; realmId: string; mapping?: ExactMapping;
  provider?: ProviderSetup; annual?: AnnualConfig; choice?: InvoiceChannel | null;
  smsConsent: boolean; smsOptedOut: boolean; consentRevision: string;
}) {
  const dates = batchDates(sendMonth);
  const proposal = proposeForClient(client, dates.servicePeriod, context.annual);
  const delivery = resolveInvoiceChannels({ choice: proposal.channelOverride ?? context.choice, phone: client.contact_phone,
    email: client.contact_email, smsConsent: context.smsConsent, smsOptedOut: context.smsOptedOut });
  const blockers = [...proposal.blockers];
  const mapping = context.mapping;
  if (!mapping?.verified || !validProviderId(mapping.customerId) || !validProviderId(mapping.realmId) || mapping.clientId !== client.id || mapping.businessId !== context.businessId || mapping.environment !== context.environment || mapping.realmId !== context.realmId)
    blockers.push('Verify exact QuickBooks customer ID in this business / environment / realm');
  const provider = context.provider;
  if (!provider?.verified || !validProviderId(provider.itemId) || !validProviderId(provider.incomeAccountId) || !provider.taxCode.trim() || !['non_taxable', 'tax_inclusive', 'tax_exclusive'].includes(provider.taxMode))
    blockers.push('Verify QuickBooks ItemRef, income account and tax setup');
  if (!delivery.channels.length) blockers.push('Confirm an available, consented invoice channel');
  const snapshot: Snapshot | null = blockers.length || proposal.excluded || proposal.amountCents == null || !mapping || !provider ? null : {
    businessId: context.businessId, environment: context.environment, realmId: context.realmId, clientId: client.id, customerId: mapping.customerId,
    amountCents: proposal.amountCents, frequency: proposal.frequency, servicePeriod: dates.servicePeriod,
    serviceStart: proposal.serviceStart, serviceEnd: proposal.serviceEnd, dueDate: dates.dueDate, sendAt: dates.sendAt,
    channels: [...delivery.channels].sort(), configRevision: proposal.configRevision, mappingRevision: mapping.revision,
    provider, contactPhone: client.contact_phone ?? null, contactEmail: client.contact_email ?? null, consentRevision: context.consentRevision,
  };
  return { client, dates, proposal, delivery, blockers, snapshot };
}
/** Annual/monthly share a collision slot, so two different kinds cannot invoice the same month. */
export const invoiceSlot = (s: Pick<Snapshot, 'businessId' | 'environment' | 'realmId' | 'clientId' | 'servicePeriod'>) =>
  `${s.businessId}:${s.environment}:${s.realmId}:${s.clientId}:${s.servicePeriod}`;
export const executionKey = (s: Snapshot) => `${invoiceSlot(s)}:${s.frequency}`;
export function snapshotCanonical(s: Snapshot): string {
  // Explicit ordering; every approval-relevant value is included, independent of object insertion order.
  return JSON.stringify([s.businessId, s.environment, s.realmId, s.clientId, s.customerId, s.amountCents, s.frequency,
    s.servicePeriod, s.serviceStart, s.serviceEnd, s.dueDate, s.sendAt, [...s.channels].sort(), s.configRevision, s.mappingRevision,
    s.provider.itemId, s.provider.incomeAccountId, s.provider.taxCode, s.provider.taxMode, s.provider.verified, s.provider.revision,
    s.contactPhone, s.contactEmail, s.consentRevision]);
}
export const approvalIsFresh = (approved: Snapshot | null, current: Snapshot | null) =>
  !!approved && !!current && snapshotCanonical(approved) === snapshotCanonical(current);
export function approvedTotals(approvals: { snapshot: Snapshot; current: Snapshot | null }[]) {
  const fresh = approvals.filter(a => approvalIsFresh(a.snapshot, a.current));
  return { count: fresh.length, amountCents: fresh.reduce((total, a) => total + a.snapshot.amountCents, 0) };
}
export const DISABLED_SCHEDULE = { billingMode: 'off', invoiceEnabled: false, announcementEnabled: false, announcementHour: null, timeZone: 'America/Chicago' } as const;
export function scheduleDue(now: Date, config: { invoiceEnabled: boolean; announcementEnabled: boolean; announcementHour: number | null }) {
  const day = chicagoDate(now); const dates = batchDates(day.slice(0, 7));
  const minute = now.getTime();
  const at = new Date(dates.sendAt).getTime();
  const invoice = config.invoiceEnabled && day === dates.sendDay && minute >= at && minute < at + 60000;
  const hour = config.announcementHour;
  const validHour = hour != null && Number.isInteger(hour) && hour >= 0 && hour < 12;
  const morning = validHour ? chicagoToUtc(dates.sendDay, hour).getTime() : NaN;
  return { invoice, announcement: config.announcementEnabled && validHour && day === dates.sendDay && minute >= morning && minute < morning + 60000,
    announcementBlocker: validHour ? null : 'Announcement morning hour requires owner approval', dates };
}
