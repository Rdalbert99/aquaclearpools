import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { fromCents, monthRange } from '@/lib/billing';
import {
  ANNOUNCEMENT_SMS, chicagoToUtc, finalWeekMonday, idempotencyKey, proposeInvoice, resolveInvoiceChannels, type InvoiceChannel,
} from '@/lib/invoice-delivery';

interface C { id: string; customer: string; service_rate: number | null; contact_phone: string | null; contact_email: string | null; notification_method: string | null }
interface P { client_id: string; invoice_channel: InvoiceChannel | null; sms_consent_at: string | null; set_by: string }
interface Item { id: string; client_id: string; kind: string; status: string; idempotency_key: string }

const last10 = (s?: string | null) => (s ?? '').replace(/\D/g, '').slice(-10);
const chLabel = (c: string[]) => (c.length === 2 ? 'Text + Email' : c[0] === 'sms' ? 'Text' : c[0] === 'email' ? 'Email' : 'None');

export default function InvoiceDelivery() {
  const [clients, setClients] = useState<C[]>([]);
  const [prefs, setPrefs] = useState<P[]>([]);
  const [optOuts, setOptOuts] = useState<{ phone: string; client_id: string | null }[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [period, setPeriod] = useState('2026-10');
  const [edit, setEdit] = useState<C | null>(null);
  const [eChoice, setEChoice] = useState<InvoiceChannel>('both');
  const [eReason, setEReason] = useState('');
  const [eConsent, setEConsent] = useState(false);

  const load = async () => {
    const [c, p, o, i] = await Promise.all([
      supabase.from('clients').select('id, customer, service_rate, contact_phone, contact_email, notification_method').eq('status', 'active').order('customer'),
      (supabase.from as any)('client_billing_preferences').select('*'),
      supabase.from('sms_opt_outs').select('phone, client_id'),
      (supabase.from as any)('billing_run_items').select('id, client_id, kind, status, idempotency_key'),
    ]);
    setClients((c.data as C[]) ?? []); setPrefs(p.data ?? []); setOptOuts((o.data as any) ?? []); setItems(i.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const [y, m] = period.split('-').map(Number);
  const sendDay = finalWeekMonday(y, m);
  const sendAt = chicagoToUtc(sendDay, 12);
  const range = monthRange(period);

  const rows = useMemo(() => clients.map((c) => {
    const pref = prefs.find((p) => p.client_id === c.id);
    const optedOut = optOuts.some((o) => o.client_id === c.id || (last10(c.contact_phone).length === 10 && last10(o.phone) === last10(c.contact_phone)));
    const consent = !!pref?.sms_consent_at || ['sms', 'both'].includes((c.notification_method ?? '').toLowerCase());
    const prop = proposeInvoice(c.customer, c.service_rate, period);
    const delivery = resolveInvoiceChannels({ choice: prop.channelOverride ?? pref?.invoice_channel, phone: c.contact_phone, email: c.contact_email, smsOptedOut: optedOut, smsConsent: consent });
    const announce = resolveInvoiceChannels({ choice: pref?.invoice_channel, phone: c.contact_phone, email: c.contact_email, smsOptedOut: optedOut, smsConsent: consent });
    const key = idempotencyKey('invoice', c.id, period);
    const item = items.find((i) => i.idempotency_key === key);
    const excluded = prop.excluded ?? (delivery.channels.length === 0 ? 'No usable channel' : null);
    return { c, pref, optedOut, prop, delivery, announce, key, item, excluded };
  }), [clients, prefs, optOuts, items, period]);

  const saveProposals = async () => {
    const payload = rows.map((r) => ({
      period_key: period, kind: 'invoice', client_id: r.c.id, idempotency_key: r.key,
      service_period_start: r.prop.frequency === 'annual' ? sendDay : range.start,
      service_period_end: r.prop.frequency === 'annual' ? `${y + 1}-${sendDay.slice(5)}` : range.end,
      amount_cents: r.prop.amountCents, frequency: r.prop.frequency, channels: r.delivery.channels,
      status: r.excluded ? 'excluded' : 'pending', exclusion_reason: r.excluded, note: r.prop.note, scheduled_for: sendAt.toISOString(),
    }));
    const { error } = await (supabase.from as any)('billing_run_items').upsert(payload, { onConflict: 'idempotency_key', ignoreDuplicates: true });
    if (error) return toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
    toast({ title: 'Saved for review', description: 'Existing items were left unchanged.' });
    load();
  };

  const setStatus = async (id: string, status: 'approved' | 'excluded' | 'pending') => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase.from as any)('billing_run_items').update({
      status, approved_by: status === 'approved' ? u.user?.id : null, approved_at: status === 'approved' ? new Date().toISOString() : null,
      exclusion_reason: status === 'excluded' ? 'Excluded by admin' : null,
    }).eq('id', id).in('status', ['pending', 'approved', 'excluded']);
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    load();
  };

  const saveOverride = async () => {
    if (!edit) return;
    const { error } = await (supabase.rpc as any)('admin_set_invoice_channel', { _client_id: edit.id, _channel: eChoice, _sms_consent_on_file: eConsent, _reason: eReason });
    if (error) return toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
    toast({ title: 'Preference saved' }); setEdit(null); setEReason(''); load();
  };

  const approved = rows.filter((r) => r.item?.status === 'approved');
  const approvedTotal = approved.reduce((s, r) => s + (r.prop.amountCents ?? 0), 0);
  const annSms = rows.filter((r) => r.announce.channels.includes('sms')).length;
  const annEmail = rows.filter((r) => r.announce.channels.includes('email')).length;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Invoice delivery</h1>
        <p className="text-sm text-muted-foreground">Text / Email choices, review and approval. Service notifications are separate.</p>
      </div>
      <Card className="border-destructive/40">
        <CardContent className="p-4 text-sm">
          <p className="font-medium">Sending is turned off</p>
          <p className="text-muted-foreground">Nothing on this page sends texts, emails or invoices. Approving only marks items as ready. Sending needs a separate, verified switch-on.</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="review">
        <TabsList><TabsTrigger value="review">Approval</TabsTrigger><TabsTrigger value="announce">Announcement</TabsTrigger></TabsList>

        <TabsContent value="review" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44" />
            <span className="text-sm text-muted-foreground">Invoices: {new Date(sendDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at 12:00 PM Chicago time ({sendAt.toISOString().slice(11, 16)} UTC)</span>
            <Button size="sm" onClick={saveProposals}>Save proposals for review</Button>
          </div>
          <p className="text-sm">Approved: {approved.length} · {fromCents(approvedTotal)}</p>
          <div className="space-y-2">
            {rows.map((r) => (
              <Card key={r.c.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div className="min-w-[12rem]">
                    <p className="font-medium">{r.c.customer}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.prop.frequency === 'annual' ? `Annual from ${sendDay}` : range.label} · {r.prop.amountCents != null ? fromCents(r.prop.amountCents) : '—'}
                      {r.prop.note ? ` · ${r.prop.note}` : ''}
                    </p>
                    <p className="text-xs">
                      {chLabel(r.delivery.channels)}{r.delivery.defaulted && !r.prop.channelOverride ? ' (not chosen)' : ''}
                      {r.delivery.skipped.map((s) => ` · no ${s.channel === 'sms' ? 'text' : 'email'}: ${s.reason}`).join('')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {r.optedOut && <Badge variant="destructive">STOP</Badge>}
                    {r.excluded && <Badge variant="outline">Exempt: {r.excluded}</Badge>}
                    {r.item && <Badge variant={r.item.status === 'approved' ? 'default' : 'secondary'}>{r.item.status}</Badge>}
                    {r.item && r.item.status !== 'approved' && !r.excluded && <Button size="sm" onClick={() => setStatus(r.item!.id, 'approved')}>Approve</Button>}
                    {r.item && r.item.status === 'approved' && <Button size="sm" variant="outline" onClick={() => setStatus(r.item!.id, 'excluded')}>Exclude</Button>}
                    <Button size="sm" variant="ghost" onClick={() => { setEdit(r.c); setEChoice(r.pref?.invoice_channel ?? 'both'); setEConsent(!!r.pref?.sms_consent_at); }}>Set channel</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="announce" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Monday morning announcement (preview)</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="whitespace-pre-wrap rounded-md bg-muted p-3">{ANNOUNCEMENT_SMS}</p>
              <p>Would go to {annSms} by text and {annEmail} by email. Customers who replied STOP or have no text consent get email only, and nothing is sent to channels that aren't on file.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Invoice channel for {edit?.customer}</DialogTitle></DialogHeader>
          <Select value={eChoice} onValueChange={(v) => setEChoice(v as InvoiceChannel)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Text and email</SelectItem><SelectItem value="sms">Text only</SelectItem><SelectItem value="email">Email only</SelectItem>
            </SelectContent>
          </Select>
          {eChoice !== 'email' && (
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={eConsent} onCheckedChange={(v) => setEConsent(!!v)} /> Customer gave text consent (on file)</label>
          )}
          <Input placeholder="Reason (required)" value={eReason} onChange={(e) => setEReason(e.target.value)} />
          <DialogFooter><Button onClick={saveOverride} disabled={eReason.trim().length < 3}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
