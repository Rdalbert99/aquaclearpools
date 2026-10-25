import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fromCents } from '@/lib/billing';
import { ANNOUNCEMENT_SMS, invoiceMessage } from '@/lib/invoice-delivery';
import { batchDates, initialSendMonth, isActiveClient, readinessRow, READINESS_GATES, type BillingClient, type ExactMapping } from '@/lib/billing-readiness';
import { accountSummary, balanceDraftLines } from '@/lib/account-balance';
import { AccountBalancePanel } from '@/components/billing/AccountBalance';

interface Preference { client_id: string; invoice_channel: 'sms' | 'email' | 'both' | null; sms_consent_at: string | null }
interface OptOut { phone: string; client_id: string | null }
interface LinkRow { client_id: string; environment: string; qbo_customer_id: string }
const last10 = (s?: string | null) => (s ?? '').replace(/\D/g, '').slice(-10);
const channelLabel = (s: string[]) => s.map(ch => ch === 'sms' ? 'Text' : 'Email').join(' + ') || 'None';

export default function InvoiceDelivery() {
  const [clients, setClients] = useState<BillingClient[]>([]);
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [optOuts, setOptOuts] = useState<OptOut[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendMonth, setSendMonth] = useState(initialSendMonth);
  const load = useCallback(async () => {
    setLoading(true);
    const failures: string[] = [];
    try {
      // Fetch ALL statuses and all pages: Active is case/whitespace normalized in one helper.
      const all: BillingClient[] = [];
      for (let offset = 0; ; offset += 500) {
        const result = await supabase.from('clients').select('id, customer, status, service_rate, contact_phone, contact_email, notification_method').order('id').range(offset, offset + 499);
        if (result.error) throw new Error(`Customers could not be read: ${result.error.message}`);
        const page = result.data ?? [];
        all.push(...page);
        if (page.length < 500) break;
      }
      setClients(all.filter(c => isActiveClient(c.status)).sort((a, b) => a.customer.localeCompare(b.customer)));
      const [p, o, l] = await Promise.all([
        supabase.from('client_billing_preferences').select('client_id, invoice_channel, sms_consent_at'),
        supabase.from('sms_opt_outs').select('phone, client_id'),
        supabase.from('client_qbo_links').select('client_id, environment, qbo_customer_id'),
      ]);
      if (p.error) failures.push(`Billing preferences unavailable: ${p.error.message}`);
      if (o.error) failures.push(`STOP list unavailable: ${o.error.message}. Text eligibility cannot be verified.`);
      if (l.error) failures.push(`Exact QuickBooks mappings unavailable: ${l.error.message}`);
      setPrefs((p.data ?? []) as Preference[]); setOptOuts(o.data ?? []); setLinks(l.data ?? []);
    } catch (error) {
      setClients([]);
      failures.push(error instanceof Error ? error.message : 'Roster could not be read');
    } finally { setErrors(failures); setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const dates = useMemo(() => { try { return batchDates(sendMonth); } catch { return null; } }, [sendMonth]);
  const rows = useMemo(() => dates ? clients.map(client => {
    const pref = prefs.find(p => p.client_id === client.id);
    const optedOut = optOuts.some(o => o.client_id === client.id || (last10(client.contact_phone).length === 10 && last10(o.phone) === last10(client.contact_phone)));
    // Only existing recorded service opt-in OR saved invoice consent counts; no guessed consent.
    const smsConsent = !errors.some(e => e.startsWith('STOP list')) && (!!pref?.sms_consent_at || ['sms', 'both'].includes((client.notification_method ?? '').trim().toLowerCase()));
    // Legacy link rows have no verified realm/business; show them but NEVER treat as exact execution mappings.
    const mapping: ExactMapping | undefined = undefined;
    return readinessRow(client, sendMonth, { businessId: '', environment: 'production', realmId: '', mapping,
      choice: pref?.invoice_channel, smsConsent, smsOptedOut: optedOut, consentRevision: pref?.sms_consent_at ?? client.notification_method ?? 'none' });
  }) : [], [clients, dates, prefs, optOuts, errors, sendMonth]);
  const proposedTotal = rows.filter(r => !r.proposal.excluded).reduce((s, r) => s + (r.proposal.amountCents ?? 0), 0);
  return (
    <div className="space-y-5 p-4 md:p-6">
      <div><h1 className="text-2xl font-bold">Invoice delivery readiness</h1><p className="text-sm text-muted-foreground">QuickBooks official invoices · billing mode off</p></div>
      <section className="space-y-2 border-y py-4 text-sm">
        <p className="font-semibold text-destructive">Not activated — invoice and announcement schedules disabled</p>
        <p>Schema, server deployment, provider verification and activation approval are pending. No live invoice, message or approval can be submitted here.</p>
        <ul className="list-disc space-y-1 pl-5">{READINESS_GATES.map(gate => <li key={gate}>{gate}</li>)}</ul>
        <p>Shadow Billing is practice / reconciliation only, not the official invoice source.</p>
      </section>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">Send month<Input aria-label="Send month" type="month" value={sendMonth} onChange={e => setSendMonth(e.target.value)} className="w-44" /></label>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>{loading ? 'Reading roster…' : 'Refresh roster'}</Button>
        <Button disabled title="Requires applied schema and verified server approval workflow">Save proposals for review</Button>
      </div>
      {dates ? <section className="grid gap-2 border-b pb-4 text-sm sm:grid-cols-3">
        <p><strong>Send:</strong> {dates.sendDay} · noon Chicago<br /><span className="text-muted-foreground">{dates.sendAt}</span></p>
        <p><strong>Service:</strong> {dates.serviceStart} – {dates.serviceEnd}</p>
        <p><strong>Due:</strong> {dates.dueDate}</p>
      </section> : <p className="text-destructive">Choose a valid send month.</p>}
      {errors.length > 0 && <section role="alert" className="space-y-1 text-sm text-destructive">{errors.map(error => <p key={error}>{error}</p>)}</section>}
      <p className="text-sm">Active roster: {rows.length} · Proposed new charges (not approved): {fromCents(proposedTotal)} · Fresh approved: 0</p>
      {!loading && !rows.length && <p className="text-sm text-muted-foreground">{errors.length ? 'Roster readiness unavailable; resolve the errors above.' : 'No eligible Active clients found.'}</p>}
      <Tabs defaultValue="invoices">
        <TabsList><TabsTrigger value="invoices">Invoices</TabsTrigger><TabsTrigger value="announcement">Announcement</TabsTrigger></TabsList>
        <TabsContent value="invoices">
          <div className="divide-y">
            {rows.map(row => {
              const { client, proposal, delivery } = row;
              const candidateLinks = links.filter(l => l.client_id === client.id);
              const summary = proposal.amountCents == null ? null : accountSummary(proposal.amountCents, { status: 'unavailable', reason: 'Live QuickBooks lookup not performed; exact realm mapping and verification pending' }, dates?.sendDay ?? '');
              return <article key={client.id} className="space-y-2 py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{client.customer}</h2><Badge variant={proposal.excluded ? 'outline' : 'secondary'}>{proposal.frequency}</Badge></div>
                <p className="break-all text-xs text-muted-foreground">Client {client.id}</p>
                <p>{proposal.amountCents == null ? 'Amount needs review' : fromCents(proposal.amountCents)} · Coverage {proposal.serviceStart} – {proposal.serviceEnd} · Due {proposal.dueDate}</p>
                {proposal.note && <p className="text-muted-foreground">{proposal.note}</p>}
                <p>{channelLabel(delivery.channels)}{delivery.defaulted && !proposal.channelOverride ? ' · default both, consent required' : ''}{delivery.skipped.map(s => ` · ${s.channel}: ${s.reason}`).join('')}</p>
                <p>QuickBooks: {candidateLinks.length ? candidateLinks.map(l => `${l.environment} customer ${l.qbo_customer_id} (realm / business not verified)`).join('; ') : 'Exact customer mapping missing'} · Provider item / tax setup pending</p>
                {proposal.excluded && <p className="font-medium">Excluded: {proposal.excluded}</p>}
                {row.blockers.map(blocker => <p key={blocker} className="text-destructive">Needs review: {blocker}</p>)}
                {summary && <AccountBalancePanel summary={summary} newLabel="Proposed new service invoice" />}
                {summary && !proposal.excluded && proposal.amountCents != null && <details><summary className="cursor-pointer">Unsent invoice notice draft</summary>{delivery.channels.map(ch => <p key={ch} className="mt-2 whitespace-pre-wrap bg-muted p-2">{invoiceMessage(client.customer, proposal.amountCents ?? 0, dates?.servicePeriod ?? '', ch, balanceDraftLines(summary))} Due {proposal.dueDate}. Earlier balance unavailable; no combined total.</p>)}</details>}
                <Button size="sm" variant="outline" disabled title="Immutable snapshot storage and approval verification pending">Approve — unavailable</Button>
              </article>;
            })}
          </div>
        </TabsContent>
        <TabsContent value="announcement" className="space-y-3 border-y py-4 text-sm">
          <h2 className="font-semibold">Announcement disabled</h2>
          <p>Morning hour and recipient scope require owner approval. Laken remains on hold. Channels and STOP are checked again before each send.</p>
          <p className="bg-muted p-3">{ANNOUNCEMENT_SMS}</p>
          <Button disabled>Schedule announcement — not activated</Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
