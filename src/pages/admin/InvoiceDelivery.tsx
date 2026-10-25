import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fromCents } from '@/lib/billing';
import { ANNOUNCEMENT_SMS, invoiceMessage } from '@/lib/invoice-delivery';
import { batchDates, initialSendMonth, isActiveClient, readinessRow, snapshotCanonical, READINESS_GATES, type BillingClient, type ExactMapping } from '@/lib/billing-readiness';
import { billingInvoke } from '@/lib/billing-transport';
import { accountSummary, balanceDraftLines, type BalanceLookup } from '@/lib/account-balance';
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
  const [authoritativeRows, setAuthoritativeRows] = useState<(ReturnType<typeof readinessRow> & {balance?:BalanceLookup})[] | null>(null);
  const [backendReady, setBackendReady] = useState(false);
  const [approvals, setApprovals] = useState<Record<string, string>>({});
  const [runs, setRuns] = useState<{id:string;state:string;provider_invoice_id:string|null;code:string;channels:Record<string,string>}[]>([]);
  const [evidenceIds, setEvidenceIds] = useState<Record<string,string>>({});
  const sequence=useRef(0);
  const activeMonth=useRef(sendMonth); activeMonth.current=sendMonth;
  const [policy,setPolicy]=useState<{billingMode:string;invoiceEnabled:boolean;announcementEnabled:boolean;migrationVerified:boolean;deploymentVerified:boolean}|null>(null);
  const [loadedMonth,setLoadedMonth]=useState<string|null>(null);
  const load = useCallback(async () => {
    const request=++sequence.current; const current=()=>sequence.current===request&&activeMonth.current===sendMonth;
    setLoading(true);setLoadedMonth(null);setPolicy(null);setRuns([]);setEvidenceIds({});setErrors([]);setClients([]);setPrefs([]);setLinks([]);setOptOuts([]);
    setBackendReady(false); setAuthoritativeRows(null); setApprovals({});
    const failures: string[] = [];
    try {
      try {
        const result = await billingInvoke<{sendMonth:string;rows:ReturnType<typeof readinessRow>[];policy:{billingMode:string;invoiceEnabled:boolean;announcementEnabled:boolean;migrationVerified:boolean;deploymentVerified:boolean};approvals:{clientId:string;fingerprint:string}[]}>({action:'readiness',sendMonth});
        if(!current()||result.sendMonth!==sendMonth)return;
        const history=await billingInvoke<{runs:typeof runs}>({action:'runs',sendMonth}).catch(()=>{failures.push('Provider history unavailable for this month.');return {runs:[]};});
        if(!current())return;
        setAuthoritativeRows(result.rows);setPolicy(result.policy);setLoadedMonth(sendMonth);setBackendReady(result.policy.migrationVerified&&result.policy.deploymentVerified);
        setApprovals(Object.fromEntries(result.rows.filter(r=>r.snapshot&&result.approvals.some(a=>a.clientId===r.client.id&&a.fingerprint===snapshotCanonical(r.snapshot as NonNullable<typeof r.snapshot>))).map(r=>[r.client.id,snapshotCanonical(r.snapshot as NonNullable<typeof r.snapshot>)])));
        setRuns(history.runs);return;
      } catch { if(!current())return;failures.push('Saved billing readiness unavailable — server deployment or setup pending. Below is an unapproved fallback only.'); }
      // Fetch ALL statuses and all pages: Active is case/whitespace normalized in one helper.
      const all: BillingClient[] = [];
      for (let offset = 0; ; offset += 500) {
        const result = await supabase.from('clients').select('id, customer, status, service_rate, contact_phone, contact_email, notification_method').order('id').range(offset, offset + 499);
        if (result.error) throw new Error(`Customers could not be read: ${result.error.message}`);
        const page = result.data ?? [];
        all.push(...page);
        if (page.length < 500) break;
      }
      if(!current())return;
      setClients(all.filter(c => isActiveClient(c.status)).sort((a, b) => a.customer.localeCompare(b.customer)));
      const [p, o, l] = await Promise.all([
        supabase.from('client_billing_preferences').select('client_id, invoice_channel, sms_consent_at'),
        supabase.from('sms_opt_outs').select('phone, client_id'),
        supabase.from('client_qbo_links').select('client_id, environment, qbo_customer_id'),
      ]);
      if(!current())return;setLoadedMonth(sendMonth);
      if (p.error) failures.push(`Billing preferences unavailable: ${p.error.message}`);
      if (o.error) failures.push(`STOP list unavailable: ${o.error.message}. Text eligibility cannot be verified.`);
      if (l.error) failures.push(`Exact QuickBooks mappings unavailable: ${l.error.message}`);
      setPrefs((p.data ?? []) as Preference[]); setOptOuts(o.data ?? []); setLinks(l.data ?? []);
    } catch (error) {
      if(!current())return;
      setClients([]);
      failures.push(error instanceof Error ? error.message : 'Roster could not be read');
    } finally { if(current()){setErrors(failures);setLoading(false);} }
  }, [sendMonth]);
  useEffect(() => { const counter=sequence;void load();return()=>{counter.current++;}; }, [load]);
  const dates = useMemo(() => { try { return batchDates(sendMonth); } catch { return null; } }, [sendMonth]);
  const rows = useMemo(() => loadedMonth!==sendMonth ? [] : authoritativeRows ?? (dates ? clients.map(client => {
    const pref = prefs.find(p => p.client_id === client.id);
    const optedOut = optOuts.some(o => o.client_id === client.id || (last10(client.contact_phone).length === 10 && last10(o.phone) === last10(client.contact_phone)));
    // Only existing recorded service opt-in OR saved invoice consent counts; no guessed consent.
    const smsConsent = !errors.some(e => e.startsWith('STOP list')) && !!pref?.sms_consent_at;
    // Legacy link rows have no verified realm/business; show them but NEVER treat as exact execution mappings.
    const mapping: ExactMapping | undefined = undefined;
    return readinessRow(client, sendMonth, { businessId: '', environment: 'production', realmId: '', mapping,
      choice: pref?.invoice_channel, smsConsent, smsOptedOut: optedOut, consentRevision: pref?.sms_consent_at ?? client.notification_method ?? 'none' });
  }) : []), [authoritativeRows, clients, dates, prefs, optOuts, errors, sendMonth, loadedMonth]);
  const proposedTotal = rows.filter(r => !r.proposal.excluded).reduce((s, r) => s + (r.proposal.amountCents ?? 0), 0);
  const approvedTotal = rows.filter(r => r.snapshot && approvals[r.client.id] === snapshotCanonical(r.snapshot)).reduce((sum,r) => sum + (r.snapshot?.amountCents ?? 0),0);
  const approveRow = async (row: ReturnType<typeof readinessRow>) => {
    if (!backendReady || !row.snapshot||loadedMonth!==sendMonth||loading) return;
    const request=sequence.current;const month=sendMonth;
    try { await billingInvoke({action:'approve',clientId:row.client.id,sendMonth,fingerprint:snapshotCanonical(row.snapshot)}); if(sequence.current===request&&activeMonth.current===month)await load(); }
    catch(error) { if(sequence.current===request&&activeMonth.current===month)setErrors(e=>[...e,error instanceof Error?error.message:'Approval not saved']); }
  };
  const reconcile = async (runId:string,channel?:'sms'|'email') => {
    try { await billingInvoke({action:channel?'reconcile_delivery':'reconcile_invoice',runId,providerId:evidenceIds[runId],...(channel?{channel}:{})}); await load(); }
    catch(error) { setErrors(e=>[...e,error instanceof Error?error.message:'Provider evidence could not be verified']); }
  };
  return (
    <div className="space-y-5 p-4 md:p-6">
      <div><h1 className="text-2xl font-bold">Invoice delivery readiness</h1><p className="text-sm text-muted-foreground">QuickBooks official invoices · billing mode {policy?.billingMode ?? 'unavailable'}</p></div>
      <section className="space-y-2 border-y py-4 text-sm">
        <p className="font-semibold text-destructive">Invoice schedule: {policy ? policy.invoiceEnabled ? 'enabled on server' : 'disabled on server' : 'unavailable'} · Announcement: {policy ? policy.announcementEnabled ? 'enabled on server' : 'disabled on server' : 'unavailable'}</p>
        <p>Server policy and saved approvals are read below. This page has no invoice-send, message-send or activation controls.</p>
        <ul className="list-disc space-y-1 pl-5">{READINESS_GATES.map(gate => <li key={gate}>{gate}</li>)}</ul>
        <p>Customer Automatic invoicing and First billing month: Clients → customer → Edit. Enrollment is not saved until backend setup is complete. Shadow Billing is practice / reconciliation only.</p>
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
      <p className="text-sm">Scoped roster: {rows.length} · Proposed new charges (not approved): {fromCents(proposedTotal)} · Fresh approved: {fromCents(approvedTotal)}</p>
      {!loading && !rows.length && <p className="text-sm text-muted-foreground">{errors.length ? 'Roster readiness unavailable; resolve the errors above.' : 'No eligible Active clients found.'}</p>}
      <Tabs defaultValue="invoices">
        <TabsList><TabsTrigger value="invoices">Invoices</TabsTrigger><TabsTrigger value="announcement">Announcement</TabsTrigger></TabsList>
        <TabsContent value="invoices">
          <div className="divide-y">
            {rows.map(row => {
              const { client, proposal, delivery } = row;
              const candidateLinks = links.filter(l => l.client_id === client.id);
              const savedBalance = 'balance' in row ? row.balance as BalanceLookup : undefined;
              const summary = proposal.amountCents == null ? null : accountSummary(proposal.amountCents, savedBalance ?? { status: 'unavailable', reason: 'Live QuickBooks lookup not performed; exact realm mapping and verification pending' }, dates?.sendDay ?? '');
              return <article key={client.id} className="space-y-2 py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{client.customer}</h2><Badge variant={proposal.excluded ? 'outline' : 'secondary'}>{proposal.frequency}</Badge></div>
                <p className="break-all text-xs text-muted-foreground">Client {client.id}</p>
                <p>Automatic invoicing: {row.snapshot?.enrollment.enabled ? 'saved on' : authoritativeRows ? row.proposal.excluded ?? 'off / blocked' : 'not saved / default off'} · First service month {row.snapshot?.enrollment.firstServicePeriod ?? 'unavailable'} · Server sender {policy ? policy.invoiceEnabled ? 'enabled' : 'disabled' : 'unavailable'}</p>
                <Link className="text-primary underline" to={`/admin/clients/${client.id}/edit`}>Review customer enrollment</Link>
                <p>{proposal.amountCents == null ? 'Amount needs review' : fromCents(proposal.amountCents)} · Coverage {proposal.serviceStart} – {proposal.serviceEnd} · Due {proposal.dueDate}</p>
                {proposal.note && <p className="text-muted-foreground">{proposal.note}</p>}
                <p>{channelLabel(delivery.channels)}{delivery.defaulted && !proposal.channelOverride ? ' · default both, consent required' : ''}{delivery.skipped.map(s => ` · ${s.channel}: ${s.reason}`).join('')}</p>
                <p>QuickBooks: {row.snapshot ? `${row.snapshot.environment} realm ${row.snapshot.realmId} customer ${row.snapshot.customerId}; item ${row.snapshot.provider.itemId}` : candidateLinks.length ? candidateLinks.map(l => `${l.environment} customer ${l.qbo_customer_id} (realm / business not verified)`).join('; ') : 'Exact customer mapping missing'} · Provider verification required</p>
                {proposal.excluded && <p className="font-medium">Excluded: {proposal.excluded}</p>}
                {row.blockers.map(blocker => <p key={blocker} className="text-destructive">Needs review: {blocker}</p>)}
                {summary && <AccountBalancePanel summary={summary} newLabel="Proposed new service invoice" />}
                {summary && !proposal.excluded && proposal.amountCents != null && <details><summary className="cursor-pointer">Unsent invoice notice draft</summary>{delivery.channels.map(ch => <p key={ch} className="mt-2 whitespace-pre-wrap bg-muted p-2">{invoiceMessage(client.customer, proposal.amountCents ?? 0, dates?.servicePeriod ?? '', ch, balanceDraftLines(summary))} Due {proposal.dueDate}. Earlier balance unavailable; no combined total.</p>)}</details>}
                <Button size="sm" variant="outline" disabled={loading||loadedMonth!==sendMonth||!backendReady || !row.snapshot} onClick={()=>void approveRow(row)} title="Approval stores a reviewed snapshot; it does not send">{approvals[client.id] ? 'Approval saved' : backendReady ? 'Approve snapshot — no send' : 'Approve — unavailable'}</Button>
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
      <section className="space-y-3 border-t pt-4"><h2 className="text-lg font-semibold">Provider reconciliation</h2>
        {!backendReady && <p className="text-sm text-muted-foreground">Unavailable until the reviewed server and permissions are deployed. No manual mark-sent control.</p>}
        {runs.map(run=><article key={run.id} className="space-y-2 border-b py-3 text-sm"><p>{run.id} · {run.state} · Invoice {run.provider_invoice_id ?? 'unknown'} · {run.code}</p>
          <Input aria-label={`Provider evidence ID ${run.id}`} value={evidenceIds[run.id]??''} onChange={e=>setEvidenceIds(ids=>({...ids,[run.id]:e.target.value}))}/>
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!backendReady||!evidenceIds[run.id]} onClick={()=>void reconcile(run.id)}>Verify invoice evidence</Button>
          {(['sms','email'] as const).map(channel=><Button key={channel} variant="outline" disabled={!backendReady||!evidenceIds[run.id]||!['unknown','sending'].includes(run.channels[channel])} onClick={()=>void reconcile(run.id,channel)}>Verify {channel} evidence</Button>)}</div>
        </article>)}
      </section>
    </div>
  );
}
