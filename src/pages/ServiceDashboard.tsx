import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, PlayCircle } from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Client = {
  id: string;
  customer: string;
  service_days: string[] | null;
  next_service_date: string | null;
  last_service_date: string | null;
  status: string | null;
  assigned_technician_id: string | null;
  secondary_technician_id: string | null;
};

type FollowUp = {
  id: string;
  client_id: string;
  scheduled_date: string;
  reason: string;
  status: string;
  assigned_technician_id: string | null;
};

type ServiceRequest = {
  id: string;
  client_id: string | null;
  contact_name: string | null;
  request_type: string;
  status: string | null;
  preferred_date: string | null;
  assigned_technician_id: string | null;
};

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const clientDueOnDay = (c: Client, date: Date): boolean => {
  if (c.status && c.status !== 'Active') return false;
  const key = dayKey(date);
  if (c.next_service_date && dayKey(new Date(c.next_service_date)) === key) return true;
  const full = DAYS[date.getDay()].toLowerCase();
  const short = DAY_SHORT[date.getDay()].toLowerCase();
  if (c.service_days?.some((d) => d.toLowerCase() === full || d.toLowerCase() === short)) return true;
  return false;
};

export default function ServiceDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [techNames, setTechNames] = useState<Record<string, string>>({});
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState(dayKey(new Date()));
  const [techFilter, setTechFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);

      const clientFilter = isAdmin
        ? supabase.from('clients').select('id, customer, service_days, next_service_date, last_service_date, status, assigned_technician_id, secondary_technician_id')
        : supabase.from('clients').select('id, customer, service_days, next_service_date, last_service_date, status, assigned_technician_id, secondary_technician_id')
            .or(`assigned_technician_id.eq.${user.id},secondary_technician_id.eq.${user.id}`);

      const [cRes, fRes, rRes, tRes] = await Promise.all([
        clientFilter,
        supabase.from('follow_up_visits').select('id, client_id, scheduled_date, reason, status, assigned_technician_id').neq('status', 'completed').neq('status', 'cancelled'),
        supabase.from('service_requests').select('id, client_id, contact_name, request_type, status, preferred_date, assigned_technician_id')
          .in('status', ['pending', 'assigned', 'scheduled', 'in-progress']),
        supabase.from('users').select('id, name').in('role', ['tech', 'admin']),
      ]);

      setClients((cRes.data ?? []) as Client[]);
      setFollowUps((fRes.data ?? []) as FollowUp[]);
      setRequests((rRes.data ?? []) as ServiceRequest[]);
      setTechNames(Object.fromEntries(((tRes.data ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name])));
      setLoading(false);
    };
    load();
  }, [user?.id, isAdmin]);

  const todayKey = dayKey(new Date());

  const techOf = (c: Client) => c.assigned_technician_id ?? c.secondary_technician_id ?? null;
  const passesTech = (techId: string | null) => techFilter === 'all' || techId === techFilter;

  /** Calendar cells for the displayed month. */
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const blanks = first.getDay();
    const result: { key: string; date: Date | null; visits: number; followUps: number; requests: number; overdue: boolean }[] = [];
    for (let i = 0; i < blanks; i++) result.push({ key: `blank-${i}`, date: null, visits: 0, followUps: 0, requests: 0, overdue: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(month.getFullYear(), month.getMonth(), d);
      const key = dayKey(date);
      const visits = clients.filter((c) => passesTech(techOf(c)) && clientDueOnDay(c, date)).length;
      const fus = followUps.filter((f) => f.scheduled_date === key && passesTech(f.assigned_technician_id)).length;
      const reqs = requests.filter((r) => r.preferred_date && dayKey(new Date(r.preferred_date)) === key && passesTech(r.assigned_technician_id)).length;
      result.push({ key, date, visits, followUps: fus, requests: reqs, overdue: key < todayKey && visits > 0 });
    }
    return result;
  }, [month, clients, followUps, requests, techFilter, todayKey]);

  const selected = useMemo(() => {
    const date = new Date(`${selectedDay}T12:00:00`);
    const visits = clients.filter((c) => passesTech(techOf(c)) && clientDueOnDay(c, date));
    const fus = followUps.filter((f) => f.scheduled_date === selectedDay && passesTech(f.assigned_technician_id));
    const reqs = requests.filter((r) => r.preferred_date && dayKey(new Date(r.preferred_date)) === selectedDay && passesTech(r.assigned_technician_id));
    return { date, visits, fus, reqs };
  }, [selectedDay, clients, followUps, requests, techFilter]);

  /** Next 14 days, day-by-day. */
  const upcoming = useMemo(() => {
    const out: { date: Date; key: string; clients: Client[] }[] = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const key = dayKey(date);
      const dayClients = clients.filter((c) => passesTech(techOf(c)) && clientDueOnDay(c, date));
      if (dayClients.length) out.push({ date, key, clients: dayClients });
    }
    return out;
  }, [clients, techFilter]);

  /** Per-tech counts for the displayed month. */
  const perTech = useMemo(() => {
    const counts = new Map<string, number>();
    const seen = new Set<string>();
    cells.forEach((cell) => {
      if (!cell.date) return;
      clients.filter((c) => clientDueOnDay(c, cell.date as Date)).forEach((c) => {
        const key = `${cell.key}|${c.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        const t = techOf(c);
        if (!passesTech(t)) return;
        counts.set(t ?? 'unassigned', (counts.get(t ?? 'unassigned') ?? 0) + 1);
      });
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, clients, techFilter]);

  const techName = (id: string | null) => (id ? techNames[id] ?? 'Technician' : 'Unassigned');
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.customer ?? 'Customer';

  const monthTitle = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const shiftMonth = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><LoadingSpinner /></div>;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Service Dashboard</h1>
              <p className="text-sm text-muted-foreground">Scheduled visits, upcoming work, and the team calendar.</p>
            </div>
          </div>
          {isAdmin && (
            <Select value={techFilter} onValueChange={setTechFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All technicians" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All technicians</SelectItem>
                {Object.entries(techNames).map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Calendar */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">{monthTitle}</CardTitle>
              <div className="flex gap-1">
                <Button size="icon" variant="outline" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => { const d = new Date(); d.setDate(1); setMonth(d); setSelectedDay(todayKey); }}>Today</Button>
                <Button size="icon" variant="outline" onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                {DAY_SHORT.map((d) => <div key={d} className="py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((cell) => {
                  if (!cell.date) return <div key={cell.key} />;
                  const total = cell.visits + cell.followUps + cell.requests;
                  const isSelected = cell.key === selectedDay;
                  const isToday = cell.key === todayKey;
                  return (
                    <button
                      key={cell.key}
                      onClick={() => setSelectedDay(cell.key)}
                      className={`min-h-[64px] rounded-md border p-1 text-left text-xs transition-colors sm:min-h-[84px] ${
                        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      } ${cell.overdue ? 'border-amber-500/50' : ''}`}
                    >
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-medium ${isToday ? 'bg-primary text-primary-foreground' : ''}`}>
                        {cell.date.getDate()}
                      </span>
                      {total > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {cell.visits > 0 && (
                            <div className={`rounded px-1 py-0.5 text-[10px] leading-tight sm:text-xs ${cell.overdue ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-primary/10 text-primary'}`}>
                              {cell.visits} visit{cell.visits > 1 ? 's' : ''}{cell.overdue ? ' · overdue' : ''}
                            </div>
                          )}
                          {cell.followUps > 0 && (
                            <div className="rounded bg-emerald-500/10 px-1 py-0.5 text-[10px] leading-tight text-emerald-700 sm:text-xs dark:text-emerald-400">
                              {cell.followUps} follow-up{cell.followUps > 1 ? 's' : ''}
                            </div>
                          )}
                          {cell.requests > 0 && (
                            <div className="rounded bg-sky-500/10 px-1 py-0.5 text-[10px] leading-tight text-sky-700 sm:text-xs dark:text-sky-400">
                              {cell.requests} request{cell.requests > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Selected day detail */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {selected.date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selected.visits.length === 0 && selected.fus.length === 0 && selected.reqs.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing scheduled this day.</p>
              )}
              {selected.visits.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.customer}</p>
                    <p className="text-xs text-muted-foreground">{techName(techOf(c))}</p>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link to={`/tech/service/${c.id}?prefill=1`}><PlayCircle className="mr-1 h-3.5 w-3.5" /> Start</Link>
                  </Button>
                </div>
              ))}
              {selected.fus.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2 rounded-md border border-emerald-500/30 p-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{clientName(f.client_id)}</p>
                    <p className="text-xs text-muted-foreground">Follow-up · {f.reason} · {techName(f.assigned_technician_id)}</p>
                  </div>
                  <Badge variant="secondary">{f.status}</Badge>
                </div>
              ))}
              {selected.reqs.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-sky-500/30 p-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.contact_name ?? clientName(r.client_id)}</p>
                    <p className="text-xs text-muted-foreground">Request · {r.request_type} · {techName(r.assigned_technician_id)}</p>
                  </div>
                  <Badge variant="secondary">{r.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Upcoming 14 days */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <ClipboardList className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Upcoming visits — next 14 days</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No visits scheduled in the next 14 days.</p>}
              {upcoming.map((day) => (
                <div key={day.key}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {day.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    {day.key === todayKey && <Badge className="ml-2" variant="secondary">Today</Badge>}
                  </p>
                  <div className="space-y-1">
                    {day.clients.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{c.customer}</p>
                          <p className="text-xs text-muted-foreground">{techName(techOf(c))}</p>
                        </div>
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/tech/service/${c.id}?prefill=1`}>Start service</Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tech calendar summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Technician workload — {monthTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {perTech.length === 0 && <p className="text-sm text-muted-foreground">No scheduled visits this month.</p>}
              {perTech.map(([techId, count]) => {
                const max = perTech[0]?.[1] ?? 1;
                return (
                  <div key={techId} className="flex items-center gap-3">
                    <span className="w-32 truncate text-sm">{techId === 'unassigned' ? 'Unassigned' : techName(techId)}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((count / max) * 100)}%` }} />
                    </div>
                    <span className="w-10 text-right text-sm font-medium">{count}</span>
                  </div>
                );
              })}
              {isAdmin && followUps.length > 0 && (
                <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                  {followUps.length} open follow-up visit{followUps.length > 1 ? 's' : ''} across all techs.{' '}
                  <Link to="/follow-ups" className="font-medium text-primary underline">Open follow-ups</Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
