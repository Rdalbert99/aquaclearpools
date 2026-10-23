import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { fromCents } from '@/lib/billing';
import { ShieldCheck, PlugZap, Copy } from 'lucide-react';

interface Status {
  configured: boolean; environment: string; redirectUri: string; needsReconnect?: boolean;
  keyCheck?: { productionClientIdDetected: boolean; productionClientSecretDetected: boolean };
  connection: { realm_id: string; company_name: string | null; refresh_expires_at: string | null; updated_at: string } | null;
}
interface TestResult {
  companyName: string | null; realmId: string; environment: string;
  invoice: { found: boolean; docNumber: string; customerId?: string; customerName?: string; totalCents?: number; balanceCents?: number; paidCents?: number; status?: string; txnDate?: string | null; linkedPaymentIds?: string[] };
}
interface ErrorLog { id: string; created_at: string; action: string; endpoint: string | null; http_status: number | null; error_code: string | null; message: string; intuit_tid: string | null; attempts: number }

class CallError extends Error { constructor(msg: string, public needsReconnect = false) { super(msg); } }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('qbo-connect', { body });
  if (error) {
    let msg = error.message; let reconnect = false;
    if (error instanceof FunctionsHttpError) {
      try { const b = await error.context.json(); msg = b.error ?? msg; reconnect = !!b.needsReconnect; } catch { /* keep */ }
    }
    throw new CallError(msg, reconnect);
  }
  return data as T;
}

export default function QuickBooksConnection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [docNumber, setDocNumber] = useState('350154860');
  const [result, setResult] = useState<TestResult | null>(null);
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const params = new URLSearchParams(window.location.search);
  const returned = params.get('qbo');

  const load = () => {
    call<Status>({ action: 'status' }).then(setStatus).catch((e) => setErr(e.message));
    call<{ logs: ErrorLog[] }>({ action: 'logs' }).then((r) => setLogs(r.logs)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const fail = (e: unknown) => {
    setErr((e as Error).message);
    if (e instanceof CallError && e.needsReconnect) setStatus((s) => (s ? { ...s, needsReconnect: true } : s));
    load();
  };

  const connect = async () => {
    setBusy(true); setErr(null);
    try {
      const { url } = await call<{ url: string }>({ action: 'start', returnUrl: `${window.location.origin}/admin/quickbooks` });
      window.location.href = url;
    } catch (e) { fail(e); setBusy(false); }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect QuickBooks? Aqua Clear will lose access until you reconnect.')) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await call<{ revoked: boolean }>({ action: 'disconnect' });
      setNote(r.revoked ? 'Disconnected and access revoked at Intuit.' : 'Disconnected here. Intuit revoke did not confirm — see the error log; you can also remove the app in QuickBooks.');
      load();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true); setErr(null); setResult(null);
    try { setResult(await call<TestResult>({ action: 'test', docNumber })); }
    catch (e) { fail(e); }
    finally { setBusy(false); }
  };

  const [sandboxList, setSandboxList] = useState<{ docNumber: string; total: number; balance: number; txnDate: string | null }[] | null>(null);
  const findSandbox = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await call<{ invoices: { docNumber: string; total: number; balance: number; txnDate: string | null }[] }>({ action: 'list_sandbox' });
      setSandboxList(r.invoices);
      if (r.invoices[0]) setDocNumber(r.invoices[0].docNumber);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const copyLog = (l: ErrorLog) => navigator.clipboard?.writeText(
    `${l.created_at} ${l.action} ${l.endpoint ?? ''} HTTP ${l.http_status ?? '-'} ${l.error_code ?? ''} intuit_tid=${l.intuit_tid ?? '-'} attempts=${l.attempts} — ${l.message}`,
  );

  const inv = result?.invoice;
  const needsReconnect = !!status?.needsReconnect;
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <PlugZap className="h-6 w-6" />
        <h1 className="text-2xl md:text-3xl font-bold">Test QuickBooks Connection</h1>
      </div>
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Read only</AlertTitle>
        <AlertDescription>This page only reads from QuickBooks. It never creates, changes or sends invoices, customers or messages.</AlertDescription>
      </Alert>

      {returned === 'connected' && <Alert><AlertTitle>QuickBooks connected</AlertTitle><AlertDescription>Now tap "Test connection".</AlertDescription></Alert>}
      {returned === 'error' && <Alert variant="destructive"><AlertTitle>QuickBooks sign-in didn't finish</AlertTitle><AlertDescription>Reason: {params.get('reason')}. Try Connect QuickBooks again.</AlertDescription></Alert>}
      {needsReconnect && <Alert variant="destructive"><AlertTitle>Reconnect needed</AlertTitle><AlertDescription>QuickBooks access expired or was revoked. Tap "Reconnect QuickBooks".</AlertDescription></Alert>}
      {err && <Alert variant="destructive"><AlertTitle>Problem</AlertTitle><AlertDescription className="break-words">{err}</AlertDescription></Alert>}
      {note && <Alert><AlertDescription>{note}</AlertDescription></Alert>}

      <Card>
        <CardHeader>
          <CardTitle>1. Connection</CardTitle>
          <CardDescription>Aqua Clear signs in to QuickBooks with its own Intuit app. Other tools' QuickBooks access can't be reused here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!status ? <p className="text-muted-foreground">Checking…</p> : (
            <>
              <div role="status" className={`rounded-md border-2 p-3 font-semibold ${status.environment === 'production' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-primary bg-primary/10 text-primary'}`}>
                {status.environment === 'production' ? 'LIVE — real Aqua Clear Pools QuickBooks company (read-only)' : 'SANDBOX — Intuit test company, not real accounting data'}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={status.configured ? 'default' : 'destructive'}>{status.configured ? 'Intuit app keys saved' : 'Intuit app keys missing'}</Badge>
                <Badge variant={status.connection && !needsReconnect ? 'default' : 'secondary'}>{!status.connection ? 'Not connected' : needsReconnect ? 'Needs reconnect' : 'Connected'}</Badge>
                <Badge variant={status.environment === 'production' ? 'destructive' : 'outline'} className="text-sm font-bold">{status.environment === 'production' ? 'LIVE QuickBooks' : 'SANDBOX (test)'}</Badge>
              </div>
              {status.keyCheck && (
                <div className="text-sm space-y-0.5">
                  <p>Production Client ID detected: <strong>{status.keyCheck.productionClientIdDetected ? 'Yes' : 'No'}</strong></p>
                  <p>Production Client Secret detected: <strong>{status.keyCheck.productionClientSecretDetected ? 'Yes' : 'No'}</strong></p>
                </div>
              )}
              {status.connection && (
                <p>Company: <strong>{status.connection.company_name ?? 'Unknown'}</strong> (ID {status.connection.realm_id})</p>
              )}
              {!status.configured && (
                <p className="text-muted-foreground">An admin must create an Intuit developer app, save its keys as {status.environment === 'production' ? 'QBO_PRODUCTION_CLIENT_ID and QBO_PRODUCTION_CLIENT_SECRET' : 'QBO_SANDBOX_CLIENT_ID and QBO_SANDBOX_CLIENT_SECRET'}, and add this redirect address in the Intuit app: <code className="break-all">{status.redirectUri}</code></p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={connect} disabled={busy || !status.configured}>
                  {status.connection ? 'Reconnect QuickBooks' : 'Connect QuickBooks'}
                </Button>
                {status.connection && <Button variant="outline" onClick={disconnect} disabled={busy}>Disconnect QuickBooks</Button>}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Look up the test invoice</CardTitle>
          <CardDescription>Reads one invoice by number and shows its amount and balance from QuickBooks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="doc">Invoice number</Label>
            <Input id="doc" inputMode="numeric" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} className="max-w-xs" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={test} disabled={busy || !status?.connection || needsReconnect}>{busy ? 'Checking…' : 'Test connection'}</Button>
            {status?.environment === 'sandbox' && (
              <Button variant="outline" onClick={findSandbox} disabled={busy || !status?.connection || needsReconnect}>Find sandbox test invoice</Button>
            )}
          </div>
          {sandboxList && (
            sandboxList.length === 0 ? <p className="text-sm text-muted-foreground">No invoices found in this sandbox company.</p> : (
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Tap one to fill in the number, then tap Test connection.</p>
                {sandboxList.map((i) => (
                  <Button key={i.docNumber} variant="ghost" size="sm" className="w-full justify-between" onClick={() => setDocNumber(i.docNumber)}>
                    <span>#{i.docNumber} · {i.txnDate}</span><span>${i.total.toFixed(2)} · bal ${i.balance.toFixed(2)}</span>
                  </Button>
                ))}
              </div>
            )
          )}
          {result && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p>Company: <strong>{result.companyName ?? 'Unknown'}</strong></p>
              {!inv?.found ? <p>Invoice #{inv?.docNumber} was <strong>not found</strong> in this QuickBooks company.</p> : (
                <>
                  <p>Invoice #{inv.docNumber} · {inv.txnDate}</p>
                  <p>Customer: {inv.customerName} (QuickBooks ID {inv.customerId})</p>
                  <p>Amount: {fromCents(inv.totalCents)} · Paid: {fromCents(inv.paidCents)} · Balance: <strong>{fromCents(inv.balanceCents)}</strong></p>
                  <p>Status: <Badge>{inv.status}</Badge> {inv.linkedPaymentIds?.length ? `· ${inv.linkedPaymentIds.length} payment(s) linked` : ''}</p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Error log</CardTitle>
          <CardDescription>Last 25 QuickBooks problems. No passwords, tokens or customer details are stored. Copy an entry to share with support or Intuit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {logs.length === 0 ? <p className="text-muted-foreground">No errors recorded.</p> : logs.map((l) => (
            <div key={l.id} className="rounded-md border p-2 flex items-start justify-between gap-2">
              <div className="min-w-0 break-words">
                <p className="font-medium">{new Date(l.created_at).toLocaleString()} · {l.action} · HTTP {l.http_status ?? '—'} · {l.error_code}</p>
                <p className="text-muted-foreground">{l.message}</p>
                {l.intuit_tid && <p className="text-xs">Intuit ref: <code>{l.intuit_tid}</code></p>}
              </div>
              <Button size="icon" variant="ghost" aria-label="Copy error entry" onClick={() => copyLog(l)}><Copy className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Need help? <Link to="/contact" className="text-primary underline-offset-2 hover:underline">Contact Aqua Clear support</Link> · 601-447-0399 · info@getaquaclear.com
      </p>
    </div>
  );
}
