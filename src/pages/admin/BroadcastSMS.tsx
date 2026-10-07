import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SmsPreview } from '@/components/tech/SmsPreview';
import { analyzeSms } from '@/lib/sms-segments';
import { normalizeToE164 } from '@/lib/phone';
import { Megaphone, RefreshCw, Send, Users, Ban, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const db = supabase as any;

// Add new groups here; the server resolves each audience key.
const AUDIENCES = [{ key: 'all_active', label: 'All Active Customers' }];

interface Template { id: string; name: string; body: string }
interface Broadcast {
  id: string; created_at: string; sent_by_name: string | null; template_name: string | null; message: string;
  audience: string; is_test: boolean; status: string; intended_count: number; sent_count: number;
  failed_count: number; excluded_opt_out_count: number; excluded_invalid_count: number; error_summary: string | null;
}
interface RecipientRow { id: string; client_name: string | null; phone_masked: string | null; status: string; error_code: string | null; error_detail: string | null }
interface OptOut { phone: string; source: string; keyword: string | null; created_at: string }

export default function BroadcastSMS() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all_active');
  const [counts, setCounts] = useState<{ recipientCount: number; activeClients: number; excludedInvalid: number; excludedOptOut: number } | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const [testing, setTesting] = useState(false);
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rows, setRows] = useState<RecipientRow[]>([]);
  const [optOuts, setOptOuts] = useState<OptOut[]>([]);
  const [newOptOut, setNewOptOut] = useState('');

  const info = analyzeSms(message);
  const template = templates.find((t) => t.id === templateId);

  const loadCount = useCallback(async () => {
    setLoadingCount(true);
    const { data, error } = await supabase.functions.invoke('send-sms-broadcast', { body: { mode: 'preview', audience } });
    setLoadingCount(false);
    if (error || data?.error) { toast.error('Could not count recipients'); return; }
    setCounts(data);
  }, [audience]);

  const loadHistory = useCallback(async () => {
    const { data } = await db.from('sms_broadcasts').select('*').order('created_at', { ascending: false }).limit(50);
    setHistory(data ?? []);
  }, []);

  const loadOptOuts = useCallback(async () => {
    const { data } = await db.from('sms_opt_outs').select('phone, source, keyword, created_at').order('created_at', { ascending: false });
    setOptOuts(data ?? []);
  }, []);

  useEffect(() => {
    db.from('sms_broadcast_templates').select('id, name, body').eq('active', true).order('sort_order')
      .then(({ data }: any) => setTemplates(data ?? []));
    loadHistory();
    loadOptOuts();
  }, [loadHistory, loadOptOuts]);

  useEffect(() => { loadCount(); }, [loadCount]);

  // Poll while a broadcast is in progress
  useEffect(() => {
    if (!history.some((h) => h.status === 'sending')) return;
    const t = setInterval(loadHistory, 4000);
    return () => clearInterval(t);
  }, [history, loadHistory]);

  const pickTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) setMessage(t.body);
  };

  const canSend = message.trim().length > 0 && !info.overLimit && (counts?.recipientCount ?? 0) > 0;

  const openConfirm = async () => {
    await loadCount();
    setConfirmOpen(true);
  };

  const doSend = async () => {
    if (!counts) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('send-sms-broadcast', {
      body: {
        mode: 'send', confirm: true, audience, message: message.trim(), expectedCount: counts.recipientCount,
        templateId: template?.id ?? null, templateName: template?.name ?? null,
      },
    });
    setSending(false);
    setConfirmOpen(false);
    if (error || data?.error) {
      let msg = data?.error;
      try { msg = msg || (await (error as any)?.context?.json())?.error; } catch { /* ignore */ }
      toast.error(msg || 'Broadcast could not be started');
      loadCount();
      return;
    }
    toast.success(`Broadcast started to ${data.recipientCount} customers. Progress shows below.`);
    loadHistory();
  };

  const doTest = async () => {
    const to = normalizeToE164(testNumber);
    if (!to) { toast.error('Enter a valid phone number'); return; }
    setTesting(true);
    const { data, error } = await supabase.functions.invoke('send-sms-broadcast', {
      body: { mode: 'test', testNumber: to, message: message.trim(), templateId: template?.id ?? null, templateName: template?.name ?? null },
    });
    setTesting(false);
    if (error || !data?.success) toast.error(data?.error || 'Test text failed');
    else toast.success(`Test text sent to ${to}`);
    loadHistory();
  };

  const toggleRows = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    const { data } = await db.from('sms_broadcast_recipients').select('id, client_name, phone_masked, status, error_code, error_detail')
      .eq('broadcast_id', id).order('status').limit(500);
    setRows(data ?? []);
  };

  const addOptOut = async () => {
    const p = normalizeToE164(newOptOut);
    if (!p) { toast.error('Enter a valid phone number'); return; }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await db.from('sms_opt_outs').upsert({ phone: p, source: 'admin', created_by: u.user?.id }, { onConflict: 'phone' });
    if (error) { toast.error('Could not save'); return; }
    setNewOptOut('');
    loadOptOuts(); loadCount();
  };

  const removeOptOut = async (phone: string) => {
    if (!confirm(`Allow broadcast texts to ${phone} again?`)) return;
    await db.from('sms_opt_outs').delete().eq('phone', phone);
    loadOptOuts(); loadCount();
  };

  const statusBadge = (s: string) => {
    const v = s === 'completed' ? 'default' : s === 'sending' ? 'secondary' : 'destructive';
    return <Badge variant={v as any}>{s.replace(/_/g, ' ')}</Badge>;
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Megaphone className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Customer Broadcast</h1>
          <p className="text-sm text-muted-foreground">Text a message to many customers at once from the Aqua Clear number.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Compose</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Send to</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((a) => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select value={templateId} onValueChange={pickTemplate}>
                <SelectTrigger><SelectValue placeholder="Start from a template (optional)" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border p-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Users className="h-4 w-4" />
              {loadingCount ? 'Counting…' : `${counts?.recipientCount ?? 0} recipients`}
            </span>
            {counts && (
              <span className="text-muted-foreground">
                of {counts.activeClients} active customers · {counts.excludedOptOut} opted out · {counts.excludedInvalid} without a valid mobile number
              </span>
            )}
            <Button variant="ghost" size="sm" className="ml-auto" onClick={loadCount}><RefreshCw className="h-4 w-4" /></Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bmsg">Message</Label>
            <Textarea id="bmsg" rows={5} value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Aqua Clear Pools: …" maxLength={1600} />
          </div>

          <SmsPreview message={message.trim()} target={`${counts?.recipientCount ?? 0} customers`} />
          {!/stop/i.test(message) && message.trim() && (
            <p className="text-xs text-muted-foreground">Tip: end broadcasts with "Reply STOP to opt out."</p>
          )}

          <Button className="w-full sm:w-auto" disabled={!canSend || sending} onClick={openConfirm}>
            <Send className="h-4 w-4 mr-2" /> Review & send
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Test send</CardTitle>
          <CardDescription>Sends this message to one number you enter only — never to customers.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <Input value={testNumber} onChange={(e) => setTestNumber(e.target.value)} placeholder="Your phone number" inputMode="tel" />
          <Button variant="outline" disabled={!message.trim() || info.overLimit || testing} onClick={doTest}>
            {testing ? 'Sending…' : 'Send test'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Send history</CardTitle>
          <Button variant="ghost" size="sm" onClick={loadHistory}><RefreshCw className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 && <p className="text-sm text-muted-foreground">No broadcasts yet.</p>}
          {history.map((h) => (
            <div key={h.id} className="rounded-md border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{format(new Date(h.created_at), 'MMM d, yyyy h:mm a')}</span>
                {h.is_test && <Badge variant="outline">Test</Badge>}
                {h.template_name && <Badge variant="secondary">{h.template_name}</Badge>}
                {statusBadge(h.status)}
                <span className="text-muted-foreground">by {h.sent_by_name ?? 'admin'}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap line-clamp-3">{h.message}</p>
              <div className="text-xs text-muted-foreground">
                {h.intended_count} intended · {h.sent_count} sent · {h.failed_count} failed
                {!h.is_test && ` · ${h.excluded_opt_out_count} opted out skipped · ${h.excluded_invalid_count} no valid number`}
                {h.error_summary && ` · Errors: ${h.error_summary}`}
              </div>
              <Button variant="link" size="sm" className="px-0 h-auto" onClick={() => toggleRows(h.id)}>
                {expanded === h.id ? 'Hide recipients' : 'Show recipients'}
              </Button>
              {expanded === h.id && (
                <div className="max-h-72 overflow-auto text-xs divide-y">
                  {rows.map((r) => (
                    <div key={r.id} className="py-1.5 flex flex-wrap gap-x-3">
                      <span className="font-medium">{r.client_name ?? '—'}</span>
                      <span className="text-muted-foreground">{r.phone_masked}</span>
                      <span className={r.status === 'sent' ? 'text-primary' : 'text-destructive'}>{r.status}</span>
                      {r.error_detail && <span className="text-destructive w-full">{r.error_code}: {r.error_detail}</span>}
                    </div>
                  ))}
                  {rows.length === 0 && <p className="py-2 text-muted-foreground">No recipient results yet.</p>}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Ban className="h-5 w-5" /> Opted-out numbers</CardTitle>
          <CardDescription>Never included in broadcasts. Customers who reply STOP are added automatically; START removes them.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={newOptOut} onChange={(e) => setNewOptOut(e.target.value)} placeholder="Phone number to exclude" inputMode="tel" />
            <Button variant="outline" onClick={addOptOut}>Add</Button>
          </div>
          {optOuts.length === 0 && <p className="text-sm text-muted-foreground">No one has opted out.</p>}
          <div className="divide-y text-sm">
            {optOuts.map((o) => (
              <div key={o.phone} className="flex items-center gap-3 py-2">
                <span className="font-mono">{o.phone}</span>
                <span className="text-xs text-muted-foreground">{o.source === 'inbound_keyword' ? `Replied ${o.keyword}` : 'Added by admin'} · {format(new Date(o.created_at), 'MMM d, yyyy')}</span>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => removeOptOut(o.phone)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !sending && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this message to {counts?.recipientCount ?? 0} customers?</AlertDialogTitle>
            <AlertDialogDescription>
              This texts every recipient from the Aqua Clear number and can't be undone. {info.segments} part{info.segments === 1 ? '' : 's'} per text.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap font-mono max-h-48 overflow-auto">{message.trim()}</div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={sending || !counts?.recipientCount} onClick={(e) => { e.preventDefault(); doSend(); }}>
              {sending ? 'Starting…' : `Yes, send to ${counts?.recipientCount ?? 0}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
