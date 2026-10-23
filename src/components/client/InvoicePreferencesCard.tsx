import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { emailUsable, phoneUsable, type InvoiceChannel } from '@/lib/invoice-delivery';
import { AccountBalancePanel, accountSummary, todayIso, useOpenBalances } from '@/components/billing/AccountBalance';

interface ClientLite { id: string; customer?: string | null; contact_phone?: string | null; contact_email?: string | null }
interface Pref { client_id: string; invoice_channel: InvoiceChannel | null; sms_consent_at: string | null; set_by: string }

const mask = (s?: string | null) => (s ? (s.includes('@') ? s.replace(/^(.{2}).*(@.*)$/, '$1***$2') : `•••${s.replace(/\D/g, '').slice(-4)}`) : 'not on file');

function Row({ client, pref, onSaved }: { client: ClientLite; pref?: Pref; onSaved: () => void }) {
  const [choice, setChoice] = useState<InvoiceChannel>(pref?.invoice_channel ?? 'both');
  const [consent, setConsent] = useState(!!pref?.sms_consent_at);
  const [saving, setSaving] = useState(false);
  const needsText = choice !== 'email';
  const hasPhone = phoneUsable(client.contact_phone);
  const hasEmail = emailUsable(client.contact_email);

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase.rpc as any)('set_my_invoice_channel', { _client_id: client.id, _channel: choice, _sms_consent: needsText ? consent : false });
    setSaving(false);
    if (error) return toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
    toast({ title: 'Invoice delivery saved' });
    onSaved();
  };

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{client.customer}</p>
        {pref?.invoice_channel
          ? <Badge variant="secondary">{pref.set_by === 'admin' ? 'Set by Aqua Clear' : 'Your choice'}</Badge>
          : <Badge variant="outline">Not chosen: text and email</Badge>}
      </div>
      <RadioGroup value={choice} onValueChange={(v) => setChoice(v as InvoiceChannel)} className="grid gap-2">
        {([['both', 'Text and email'], ['sms', 'Text only'], ['email', 'Email only']] as const).map(([v, l]) => (
          <Label key={v} className="flex items-center gap-2 font-normal"><RadioGroupItem value={v} /> {l}</Label>
        ))}
      </RadioGroup>
      <p className="text-xs text-muted-foreground">Text to {mask(client.contact_phone)} · Email to {mask(client.contact_email)}</p>
      {needsText && !hasPhone && <p className="text-xs text-destructive">No mobile number on file. Contact Aqua Clear to add one.</p>}
      {choice !== 'sms' && !hasEmail && <p className="text-xs text-destructive">No email on file. Contact Aqua Clear to add one.</p>}
      {needsText && (
        <label className="flex items-start gap-2 text-xs">
          <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
          I agree to receive invoice text messages from Aqua Clear Pools. Message and data rates may apply. Reply STOP to opt out, HELP for help.
        </label>
      )}
      <Button size="sm" onClick={save} disabled={saving || (needsText && !consent)}>Save</Button>
    </div>
  );
}

export function InvoicePreferencesCard({ clients }: { clients: ClientLite[] }) {
  const [prefs, setPrefs] = useState<Pref[]>([]);
  const { balances } = useOpenBalances(clients.map((c) => c.id), 'customer');
  const load = async () => {
    if (!clients.length) return;
    const { data } = await (supabase.from as any)('client_billing_preferences').select('*').in('client_id', clients.map((c) => c.id));
    setPrefs((data as Pref[]) ?? []);
  };
  useEffect(() => { load(); }, [clients.map((c) => c.id).join()]);
  if (!clients.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing notifications</CardTitle>
        <CardDescription>How you get invoices. Your service visit notifications aren't affected.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {clients.map((c) => (
          <div key={c.id} className="space-y-2">
            {balances[c.id] && (
              <div>
                <p className="mb-1 text-sm font-medium">Open invoices</p>
                <AccountBalancePanel summary={accountSummary(0, balances[c.id], todayIso())} />
              </div>
            )}
            <Row key={c.id + (prefs.find((p) => p.client_id === c.id)?.invoice_channel ?? '')} client={c} pref={prefs.find((p) => p.client_id === c.id)} onSaved={load} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
