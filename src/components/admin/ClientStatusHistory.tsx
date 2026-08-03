import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { History, ArrowRight } from 'lucide-react';

interface StatusHistoryEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_by_name: string | null;
  created_at: string;
}

interface ClientStatusHistoryProps {
  clientId: string;
}

const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const s = (status || '').toLowerCase();
  if (s === 'active') return 'default';
  if (s === 'suspended') return 'destructive';
  if (s === 'inactive') return 'secondary';
  return 'outline';
};

export function ClientStatusHistory({ clientId }: ClientStatusHistoryProps) {
  const [entries, setEntries] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('client_status_history')
        .select('id, old_status, new_status, changed_by_name, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!cancelled) {
        if (error) {
          console.error('Failed to load status history:', error);
          setEntries([]);
        } else {
          setEntries((data || []) as StatusHistoryEntry[]);
        }
        setLoading(false);
      }
    };

    if (clientId) load();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Account Status History
        </CardTitle>
        <CardDescription>Who changed this account's status, what changed, and when.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No status changes recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-2 border-b border-border pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {entry.old_status ? (
                    <>
                      <Badge variant={statusVariant(entry.old_status)}>{entry.old_status}</Badge>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Created as</span>
                  )}
                  <Badge variant={statusVariant(entry.new_status)}>{entry.new_status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{entry.changed_by_name || 'System'}</span>
                  {' · '}
                  {new Date(entry.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
