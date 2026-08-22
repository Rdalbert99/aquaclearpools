import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, MessageSquare, Send, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { parsePhoneField } from '@/lib/phone';
import { logMessageSend } from '@/lib/message-log';
import { extractSendError } from '@/lib/send-error';

interface LogRow {
  id: string;
  client_id?: string | null;
  technician_id?: string | null;
  client_name: string | null;
  technician_name: string | null;
  source: string;
  channel: string;
  recipient: string | null;
  message: string | null;
  status: string;
  error_detail: string | null;
  provider_message_id: string | null;
  created_at: string;
  delivery_status: string | null;
  delivered_at: string | null;
  provider_status_detail: string | null;
  opened_at: string | null;
  last_open_at: string | null;
  open_count: number | null;
}

const statusVariant = (status: string) => {
  switch (status) {
    case 'sent':
      return 'default' as const;
    case 'failed':
      return 'destructive' as const;
    case 'fallback':
      return 'secondary' as const;
    default:
      return 'outline' as const;
  }
};

const deliveryVariant = (status: string | null) => {
  switch (status) {
    case 'opened':
      return 'default' as const;
    case 'delivered':
      return 'secondary' as const;
    case 'undelivered':
    case 'unsubscribed':
      return 'destructive' as const;
    default:
      return 'outline' as const;
  }
};

const deliveryLabel = (r: LogRow) => {
  if (r.status !== 'sent') return null;
  if (r.opened_at) return 'opened';
  return r.delivery_status ?? 'awaiting delivery';
};

/** A failed SMS whose recipient field can be repaired into valid E.164 numbers. */
function retryTargets(r: LogRow): string[] {
  if (r.channel !== 'sms' || r.status !== 'failed' || !r.recipient || !r.message) return [];
  return parsePhoneField(r.recipient).valid;
}

export default function MessageLogs() {
  const { toast } = useToast();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  async function resend(r: LogRow) {
    const targets = retryTargets(r);
    if (!targets.length) return;
    setRetryingId(r.id);
    let sent = 0;
    const failures: string[] = [];

    for (const to of targets) {
      try {
        const { data, error } = await supabase.functions.invoke('send-sms-via-telnyx', {
          body: { to, message: r.message },
        });
        const failed = error || (data && (data as any).success === false);
        const detail = failed ? await extractSendError(error, data) : null;
        if (failed) failures.push(`${to} — ${detail}`);
        else sent += 1;
        await logMessageSend({
          clientId: r.client_id ?? null,
          clientName: r.client_name,
          technicianId: r.technician_id ?? null,
          technicianName: r.technician_name,
          source: 'resend_failed',
          channel: 'sms',
          recipient: to,
          message: r.message,
          status: failed ? 'failed' : 'sent',
          errorDetail: detail,
          providerMessageId: failed ? null : ((data as any)?.messageId ?? null),
        });
      } catch (e: any) {
        failures.push(`${to} — ${e?.message || 'Network error'}`);
      }
    }

    setRetryingId(null);
    toast({
      title: sent ? `Resent to ${sent} number(s)` : 'Resend failed',
      description: failures.length ? failures.join('; ') : 'Message delivered to Telnyx.',
      variant: sent ? 'default' : 'destructive',
    });
    load();
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('message_send_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setRows((data as any as LogRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const term = search.trim().toLowerCase();
  const filtered = term
    ? rows.filter(r =>
        [r.client_name, r.technician_name, r.recipient, r.status, r.error_detail]
          .some(v => (v ?? '').toLowerCase().includes(term))
      )
    : rows;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" /> Message Send Log
        </h1>
        <Button variant="outline" asChild>
          <Link to="/admin/telnyx-status">
            <Radio className="h-4 w-4 mr-2" /> Webhook status
          </Link>
        </Button>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <Input
        placeholder="Search by client, tech, number, or error…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 && !loading && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No message attempts recorded yet.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map((r) => (
          <Card key={r.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-base">{r.client_name || 'Unknown client'}</CardTitle>
                  <CardDescription>
                    {new Date(r.created_at).toLocaleString()} · {r.technician_name || 'Unknown tech'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{r.channel}</Badge>
                  <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                  {deliveryLabel(r) && (
                    <Badge variant={deliveryVariant(r.opened_at ? 'opened' : r.delivery_status)}>
                      {deliveryLabel(r)}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="break-words">
                <span className="text-muted-foreground">To: </span>
                {r.recipient || '—'}
              </p>
              {(r.delivered_at || r.opened_at || r.provider_status_detail) && (
                <p className="break-words text-muted-foreground">
                  {r.delivered_at && <>Delivered {new Date(r.delivered_at).toLocaleString()}. </>}
                  {r.opened_at ? (
                    <>
                      Opened {new Date(r.opened_at).toLocaleString()}
                      {(r.open_count ?? 0) > 1 && <> ({r.open_count} opens, last {new Date(r.last_open_at || r.opened_at).toLocaleString()})</>}.
                    </>
                  ) : (
                    <>Link not opened yet. </>
                  )}
                  {r.provider_status_detail && <> {r.provider_status_detail}</>}
                </p>
              )}
              {r.error_detail && (
                <p className="break-words text-destructive">
                  <span className="text-muted-foreground">Reason: </span>
                  {r.error_detail}
                </p>
              )}
              {retryTargets(r).length > 0 && (
                <div className="pt-1">
                  <Button size="sm" onClick={() => resend(r)} disabled={retryingId === r.id}>
                    <Send className="h-4 w-4 mr-2" />
                    {retryingId === r.id
                      ? 'Resending…'
                      : `Resend to ${retryTargets(r).join(', ')}`}
                  </Button>
                </div>
              )}
              {r.provider_message_id && (
                <p className="break-words text-muted-foreground text-xs">ID: {r.provider_message_id}</p>
              )}
              {r.message && (
                <details>
                  <summary className="cursor-pointer text-muted-foreground">Message text</summary>
                  <p className="whitespace-pre-wrap mt-1">{r.message}</p>
                </details>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
