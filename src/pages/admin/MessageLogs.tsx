import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, MessageSquare } from 'lucide-react';

interface LogRow {
  id: string;
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

export default function MessageLogs() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="break-words">
                <span className="text-muted-foreground">To: </span>
                {r.recipient || '—'}
              </p>
              {r.error_detail && (
                <p className="break-words text-destructive">
                  <span className="text-muted-foreground">Reason: </span>
                  {r.error_detail}
                </p>
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
