import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { fromCents } from '@/lib/billing';
import { ShieldCheck, PlugZap } from 'lucide-react';

interface Status {
  configured: boolean; environment: string; redirectUri: string;
  connection: { realm_id: string; company_name: string | null; refresh_expires_at: string | null; updated_at: string } | null;
}
interface TestResult {
  companyName: string | null; realmId: string; environment: string;
  invoice: { found: boolean; docNumber: string; customerId?: string; customerName?: string; totalCents?: number; balanceCents?: number; paidCents?: number; status?: string; txnDate?: string | null; linkedPaymentIds?: string[] };
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('qbo-connect', { body });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      try { msg = (await error.context.json()).error ?? msg; } catch { /* keep */ }
    }
    throw new Error(msg);
  }
  return data as T;
}

export default function QuickBooksConnection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [docNumber, setDocNumber] = useState('350154860');
  const [result, setResult] = useState<TestResult | null>(null);
  const params = new URLSearchParams(window.location.search);
  const returned = params.get('qbo');

  const load = () => call<Status>({ action: 'status' }).then(setStatus).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const connect = async () => {
    setBusy(true); setErr(null);
    try {
      const { url } = await call<{ url: string }>({ action: 'start', returnUrl: `${window.location.origin}/admin/quickbooks` });
      window.location.href = url;
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  const test = async () => {
    setBusy(true); setErr(null); setResult(null);
    try { setResult(await call<TestResult>({ action: 'test', docNumber })); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const inv = result?.invoice;
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
      {err && <Alert variant="destructive"><AlertTitle>Problem</AlertTitle><AlertDescription className="break-words">{err}</AlertDescription></Alert>}

      <Card>
        <CardHeader>
          <CardTitle>1. Connection</CardTitle>
          <CardDescription>Aqua Clear signs in to QuickBooks with its own Intuit app. Other tools' QuickBooks access can't be reused here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!status ? <p className="text-muted-foreground">Checking…</p> : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant={status.configured ? 'default' : 'destructive'}>{status.configured ? 'Intuit app keys saved' : 'Intuit app keys missing'}</Badge>
                <Badge variant={status.connection ? 'default' : 'secondary'}>{status.connection ? 'Connected' : 'Not connected'}</Badge>
                <Badge variant="outline">{status.environment}</Badge>
              </div>
              {status.connection && (
                <p>Company: <strong>{status.connection.company_name ?? 'Unknown'}</strong> (ID {status.connection.realm_id})</p>
              )}
              {!status.configured && (
                <p className="text-muted-foreground">An admin must create an Intuit developer app, save its keys as QBO_CLIENT_ID and QBO_CLIENT_SECRET, and add this redirect address in the Intuit app: <code className="break-all">{status.redirectUri}</code></p>
              )}
              <Button onClick={connect} disabled={busy || !status.configured}>
                {status.connection ? 'Reconnect QuickBooks' : 'Connect QuickBooks'}
              </Button>
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
          <Button onClick={test} disabled={busy || !status?.connection}>{busy ? 'Checking…' : 'Test connection'}</Button>
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
    </div>
  );
}
