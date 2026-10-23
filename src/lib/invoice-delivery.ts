// Invoice delivery rules (Text / Email / Both). Separate from service notifications.
// Pure functions so the admin approval screen and tests agree.

export type InvoiceChannel = 'sms' | 'email' | 'both';
export type SendChannel = 'sms' | 'email';

export interface DeliveryInput {
  /** Customer's saved invoice choice; null/undefined = not chosen yet. */
  choice?: InvoiceChannel | null;
  phone?: string | null;
  email?: string | null;
  /** On the STOP list. Always wins. */
  smsOptedOut: boolean;
  /** Recorded text consent (invoice consent or existing service-text opt-in). */
  smsConsent: boolean;
}

export interface DeliveryResult {
  channels: SendChannel[];
  skipped: { channel: SendChannel; reason: string }[];
  defaulted: boolean;
}

export const phoneUsable = (p?: string | null) => (p ?? '').replace(/\D/g, '').length >= 10;
export const emailUsable = (e?: string | null) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((e ?? '').trim());

/** Unset choice defaults to BOTH, but only channels that are actually available and consented. */
export function resolveInvoiceChannels(i: DeliveryInput): DeliveryResult {
  const defaulted = !i.choice;
  const wanted: SendChannel[] = !i.choice || i.choice === 'both' ? ['sms', 'email'] : [i.choice];
  const channels: SendChannel[] = [];
  const skipped: DeliveryResult['skipped'] = [];
  for (const ch of wanted) {
    if (ch === 'sms') {
      if (i.smsOptedOut) skipped.push({ channel: 'sms', reason: 'Replied STOP' });
      else if (!phoneUsable(i.phone)) skipped.push({ channel: 'sms', reason: 'No mobile number' });
      else if (!i.smsConsent) skipped.push({ channel: 'sms', reason: 'No text consent on file' });
      else channels.push('sms');
    } else if (!emailUsable(i.email)) skipped.push({ channel: 'email', reason: 'No valid email' });
    else channels.push('email');
  }
  return { channels, skipped, defaulted };
}

/** Monday that starts the month's final week (the last Monday of the month). */
export function finalWeekMonday(year: number, month1: number): string {
  const last = new Date(Date.UTC(year, month1, 0));
  const back = (last.getUTCDay() + 6) % 7; // days since Monday
  last.setUTCDate(last.getUTCDate() - back);
  return last.toISOString().slice(0, 10);
}

/** UTC instant for a wall-clock time in America/Chicago (handles CDT/CST). */
export function chicagoToUtc(dateIso: string, hour: number, minute = 0): Date {
  const [y, m, d] = dateIso.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(guess));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asChicago = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
  return new Date(guess + (guess - asChicago));
}

export const idempotencyKey = (kind: 'invoice' | 'announcement', clientId: string, periodKey: string) =>
  `${kind}:${periodKey}:${clientId}`;

export interface RosterRule {
  match: string; // lower-case customer name contains
  action: 'exclude' | 'override';
  reason: string;
  amountCents?: number;
  frequency?: string;
  channel?: InvoiceChannel;
  /** Only applies in this period (YYYY-MM); other periods excluded with reason. */
  period?: string;
}

/** Roster corrections from the owner (Oct 2026). Applied as proposals for review, never written to customer records. */
export const ROSTER_RULES: RosterRule[] = [
  { match: 'peggy mcquarter', action: 'override', amountCents: 300000, frequency: 'annual', channel: 'sms', period: '2026-10',
    reason: 'Annual prepaid at full rate $3,000, text only, no monthly invoice' },
  { match: 'shelby thames', action: 'exclude', reason: 'Annual prepaid, due late November' },
  { match: 'jennifer robinson', action: 'exclude', reason: 'Annual prepaid, due late November' },
  { match: 'laken ford ramey', action: 'exclude', reason: 'Rate pending' },
  { match: 'laken ramey', action: 'exclude', reason: 'Rate pending' },
];

export interface ProposedItem {
  amountCents: number | null;
  frequency: string;
  channelOverride: InvoiceChannel | null;
  excluded: string | null;
  note: string | null;
}

/** Proposes an invoice for one customer and period. $0 / missing rates are excluded as uncertain. */
export function proposeInvoice(name: string, monthlyRateDollars: number | null | undefined, periodKey: string): ProposedItem {
  const n = name.toLowerCase();
  const rule = ROSTER_RULES.find((r) => n.includes(r.match));
  if (rule?.action === 'exclude') return { amountCents: null, frequency: 'monthly', channelOverride: null, excluded: rule.reason, note: null };
  if (rule?.action === 'override') {
    if (rule.period && rule.period !== periodKey)
      return { amountCents: null, frequency: rule.frequency ?? 'monthly', channelOverride: null, excluded: `${rule.reason} (billed ${rule.period})`, note: null };
    return { amountCents: rule.amountCents ?? null, frequency: rule.frequency ?? 'monthly', channelOverride: rule.channel ?? null, excluded: null, note: rule.reason };
  }
  const rate = Number(monthlyRateDollars);
  if (!isFinite(rate) || rate <= 0) return { amountCents: null, frequency: 'monthly', channelOverride: null, excluded: 'No confirmed rate', note: null };
  return { amountCents: Math.round(rate * 100), frequency: 'monthly', channelOverride: null, excluded: null, note: null };
}

export const ANNOUNCEMENT_SMS =
  'Aqua Clear Pools: Starting today, your pool service invoices will arrive by text and email. To choose just one, sign in at getaquaclear.com/auth/login → Profile → Billing notifications. No account yet? Use the invite link we sent or reply to request one. Reply STOP to opt out.';

export const ANNOUNCEMENT_EMAIL_SUBJECT = 'New: your Aqua Clear invoices by text and email';

export function invoiceMessage(name: string, amountCents: number, periodLabel: string, channel: SendChannel) {
  const amt = (amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const base = `Aqua Clear Pools: Hi ${name}, your ${periodLabel} invoice is ${amt}. Sign in to view and pay: getaquaclear.com/auth/login. To change how you get invoices: Profile → Billing notifications.`;
  return channel === 'sms' ? `${base} Reply STOP to opt out.` : base;
}
