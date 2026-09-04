import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { CalendarClock, CheckCircle2, PlayCircle, Search } from 'lucide-react';
import { FOLLOW_UP_REASONS } from '@/components/tech/FollowUpPrompt';

type Row = {
  id: string;
  client_id: string;
  scheduled_date: string;
  reason: string;
  notes: string | null;
  status: string;
  created_at: string;
  clients?: { customer: string } | null;
};

function dayDiff(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateStr}T00:00:00`);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export default function FollowUps() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('open');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('follow_up_visits')
      .select('id, client_id, scheduled_date, reason, notes, status, created_at, clients(customer)')
      .order('scheduled_date', { ascending: true });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setRows((data ?? []) as unknown as Row[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function setStatus(id: string, status: string) {
    const { error } = await supabase
      .from('follow_up_visits')
      .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setRows(prev => prev.map(r => (r.id === id ? { ...r, status } : r)));
  }

  const filtered = useMemo(() => rows.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (reasonFilter !== 'all' && r.reason !== reasonFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const name = r.clients?.customer?.toLowerCase() ?? '';
      if (!name.includes(q) && !r.reason.toLowerCase().includes(q) && !(r.notes ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [rows, statusFilter, reasonFilter, search]);

  const overdue = filtered.filter(r => r.status === 'open' && dayDiff(r.scheduled_date) < 0);
  const today = filtered.filter(r => r.status === 'open' && dayDiff(r.scheduled_date) === 0);
  const upcoming = filtered.filter(r => !(r.status === 'open' && dayDiff(r.scheduled_date) <= 0));

  const Group = ({ title, items, tone }: { title: string; items: Row[]; tone?: string }) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <h2 className={`text-sm font-semibold uppercase tracking-wide ${tone ?? 'text-muted-foreground'}`}>
          {title} ({items.length})
        </h2>
        {items.map(r => {
          const diff = dayDiff(r.scheduled_date);
          return (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.clients?.customer ?? 'Client'}</span>
                    <Badge variant="outline">{r.reason}</Badge>
                    {r.status !== 'open' && <Badge variant="secondary">{r.status}</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {new Date(`${r.scheduled_date}T00:00:00`).toLocaleDateString()}
                    {r.status === 'open' && (diff < 0 ? ` · ${Math.abs(diff)} day(s) overdue` : diff === 0 ? ' · today' : ` · in ${diff} day(s)`)}
                  </p>
                  {r.notes && <p className="mt-1 text-sm">{r.notes}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/tech/service/${r.client_id}`}><PlayCircle className="mr-1.5 h-4 w-4" /> Start visit</Link>
                  </Button>
                  {r.status === 'open' ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setStatus(r.id, 'completed')}>
                        <CheckCircle2 className="mr-1.5 h-4 w-4" /> Done
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, 'canceled')}>Cancel</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, 'open')}>Reopen</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CalendarClock className="h-6 w-6" /> Follow-Ups
        </h1>
        <p className="text-sm text-muted-foreground">
          Visits scheduled from completed services{user?.role === 'admin' ? ' across all technicians' : ''}.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Narrow by status, reason, or customer.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search customer or reason" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reasonFilter} onValueChange={setReasonFilter}>
            <SelectTrigger><SelectValue placeholder="Reason" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reasons</SelectItem>
              {FOLLOW_UP_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No follow-ups match these filters.</CardContent></Card>
      ) : (
        <div className="space-y-6">
          <Group title="Overdue" items={overdue} tone="text-red-600" />
          <Group title="Today" items={today} tone="text-amber-600" />
          <Group title="Upcoming & closed" items={upcoming} />
        </div>
      )}
    </div>
  );
}
