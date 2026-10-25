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

/** Legacy callers delegate to the identity-aware readiness proposal; period means SERVICE month. */
export { proposeInvoice } from './billing-readiness';

// Owner-approved announcement wording (Oct 25, 2026). The email body is stored and reviewed
// exactly as approved; the text message is the same body with the required prefix and STOP
// footer. Neither channel text is silently modified by the other.
export const ANNOUNCEMENT_EMAIL_SUBJECT = 'New: your Aqua Clear invoices by text and email';
export const ANNOUNCEMENT_EMAIL_BODY = `Good morning! This is Randy with Aqua Clear Pools. We’re updating our invoicing system. Your November invoice will be sent today at noon and is due November 1.

You do not need to create an account to pay. Simply open your invoice, select View & Pay, and follow the payment instructions.

Our customer portal is optional. If you already have an account, sign in to manage your billing notification preferences: https://getaquaclear.com/auth/login

Need help or want portal access? Just reply and let me know. Thank you!`;
export const SMS_PREFIX = 'Aqua Clear Pools:';
export const SMS_FOOTER = 'Reply STOP to opt out.';
export const ANNOUNCEMENT_SMS = `${SMS_PREFIX}\n\n${ANNOUNCEMENT_EMAIL_BODY}\n\n${SMS_FOOTER}`;
/** Exact reviewed text for one channel; never reused across channels. */
export const announcementText = (channel: SendChannel) => (channel === 'sms' ? ANNOUNCEMENT_SMS : ANNOUNCEMENT_EMAIL_BODY);

export function invoiceMessage(name: string, amountCents: number, periodLabel: string, channel: SendChannel, balanceLines = '') {
  const amt = (amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  // Payment uses the verified official QuickBooks invoice link on the invoice itself; no
  // Aqua Clear account is required to pay. The portal is optional and only manages preferences.
  const base = `Aqua Clear Pools: Hi ${name}, your ${periodLabel} invoice is ${amt}.${balanceLines} Open the secure QuickBooks invoice link included with your invoice to view and pay — no account needed. The customer portal is optional for billing notification preferences: getaquaclear.com/auth/login.`;
  return channel === 'sms' ? `${base} Reply STOP to opt out.` : base;
}
