import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle2, Copy, RefreshCw, Radio } from 'lucide-react';

interface ProfileStatus {
  id: string;
  name: string;
  enabled: boolean;
  webhookUrl: string | null;
  webhookFailoverUrl: string | null;
  webhookApiVersion: string | null;
  inboundOk: boolean;
  deliveryOk: boolean;
}

interface StatusPayload {
  configured: boolean;
  apiKeyPresent: boolean;
  expected: { inbound: string; delivery: string };
  profiles: ProfileStatus[];
  error?: string;
}

export default function TelnyxStatus() {
  const { toast } = useToast();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [inboundCount, setInboundCount] = useState<number | null>(null);
  const [lastInboundAt, setLastInboundAt] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data, error }, inbound] = await Promise.all([
      supabase.functions.invoke('telnyx-webhook-status'),
      supabase
        .from('inbound_sms_messages')
        .select('created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(1),
    ]);

    if (error) {
      setStatus({
        configured: false,
        apiKeyPresent: false,
        expected: { inbound: '', delivery: '' },
        profiles: [],
        error: error.message,
      });
    } else {
      setStatus(data as StatusPayload);
    }
    setInboundCount(inbound.count ?? 0);
    setLastInboundAt(inbound.data?.[0]?.created_at ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: 'Copied', description: 'Webhook URL copied to clipboard.' });
  };

  const ok = status?.configured === true;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Radio className="h-5 w-5" /> Telnyx Webhook Status
        </h1>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Re-check
        </Button>
      </div>

      {status && (
        <Alert variant={ok ? 'default' : 'destructive'}>
          {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <AlertTitle>
            {ok ? 'Webhooks are configured correctly' : 'Webhooks are NOT configured'}
          </AlertTitle>
          <AlertDescription>
            {ok
              ? 'Customer replies and delivery receipts will reach the app.'
              : status.error ||
                'Until the messaging profile points at the URLs below, incoming customer texts and delivery receipts are never delivered to the app.'}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Inbound message activity</CardTitle>
          <CardDescription>What the app has actually received.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>Inbound messages stored: <strong>{inboundCount ?? '—'}</strong></p>
          <p>
            Last inbound message:{' '}
            <strong>{lastInboundAt ? new Date(lastInboundAt).toLocaleString() : 'never'}</strong>
          </p>
        </CardContent>
      </Card>

      {status && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Required URLs</CardTitle>
            <CardDescription>Paste these into your Telnyx Messaging Profile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { label: 'Inbound / Webhook URL', url: status.expected.inbound },
              { label: 'Failover / Delivery status URL', url: status.expected.delivery },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <p className="text-muted-foreground">{item.label}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-muted px-2 py-1 text-xs">{item.url || '—'}</code>
                  <Button size="icon" variant="ghost" onClick={() => copy(item.url)} disabled={!item.url}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {status?.profiles?.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Messaging profiles</CardTitle>
            <CardDescription>Live values read from your Telnyx account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {status.profiles.map((p) => (
              <div key={p.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-medium">{p.name}</span>
                  <div className="flex gap-2">
                    <Badge variant={p.enabled ? 'secondary' : 'outline'}>{p.enabled ? 'enabled' : 'disabled'}</Badge>
                    <Badge variant={p.inboundOk ? 'default' : 'destructive'}>
                      inbound {p.inboundOk ? 'ok' : 'missing'}
                    </Badge>
                    <Badge variant={p.deliveryOk ? 'default' : 'destructive'}>
                      delivery {p.deliveryOk ? 'ok' : 'missing'}
                    </Badge>
                  </div>
                </div>
                <p className="break-all text-muted-foreground text-xs">Webhook: {p.webhookUrl || 'not set'}</p>
                <p className="break-all text-muted-foreground text-xs">Failover: {p.webhookFailoverUrl || 'not set'}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!ok && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">How to fix it (2 minutes)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Sign in at <strong>portal.telnyx.com</strong>.</li>
              <li>Open <strong>Messaging → Programmable Messaging → Messaging Profiles</strong>.</li>
              <li>Click the profile your Aqua Clear number uses.</li>
              <li>In <strong>Inbound Settings</strong>, set <strong>Webhook URL</strong> to the inbound URL above.</li>
              <li>Set <strong>Webhook Failover URL</strong> to the delivery status URL above.</li>
              <li>Set <strong>Webhook API Version</strong> to <strong>API v2</strong>.</li>
              <li>Click <strong>Save</strong>, then press <strong>Re-check</strong> at the top of this page.</li>
              <li>Text your Aqua Clear number from a phone — it should appear under Messages within seconds.</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
