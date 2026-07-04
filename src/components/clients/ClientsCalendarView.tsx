import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, CalendarDays, Users, Eye, RotateCcw, CheckCircle2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';


export interface CalendarClient {
  id: string;
  customer: string;
  pool_size?: number | null;
  pool_type?: string | null;
  last_service_date?: string | null;
  service_days?: string[] | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface Props {
  clients: CalendarClient[];
  /** If true, show admin-style links (view client). Otherwise show tech "Start Service". */
  adminMode?: boolean;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function scheduledDows(client: CalendarClient): number[] {
  if (!client.service_days?.length) return [];
  const out = new Set<number>();
  client.service_days.forEach(d => {
    const v = (d || '').toLowerCase().slice(0, 3);
    const idx = DAY_NAMES.findIndex(n => n.toLowerCase().startsWith(v));
    if (idx >= 0) out.add(idx);
  });
  return [...out];
}

function clientScheduledOn(client: CalendarClient, date: Date): boolean {
  const dows = scheduledDows(client);
  return dows.includes(date.getDay());
}

/** Minimum gap (in days) between scheduled visits. Defaults to 7 if single/none. */
function minScheduleGap(dows: number[]): number {
  if (dows.length <= 1) return 7;
  const sorted = [...dows].sort((a, b) => a - b);
  let min = 7;
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length];
    const gap = i + 1 < sorted.length ? next - sorted[i] : 7 - sorted[i] + sorted[0];
    if (gap > 0 && gap < min) min = gap;
  }
  return min;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * A scheduled day D is "covered" (already serviced) if the last service date
 * falls within the most recent service cycle ending at D — specifically
 * (D - cycle, D]. This makes early services (e.g. doing Tuesday's client on
 * Monday) count toward that visit, so the client disappears until their next
 * scheduled day after the service.
 */
function isCovered(client: CalendarClient, date: Date): boolean {
  if (!client.last_service_date) return false;
  const last = startOfDay(new Date(client.last_service_date));
  const d = startOfDay(date);
  const gap = minScheduleGap(scheduledDows(client));
  const windowStart = new Date(d);
  windowStart.setDate(d.getDate() - gap);
  return last > windowStart && last <= d;
}

function clientDueOn(client: CalendarClient, date: Date): boolean {
  return clientScheduledOn(client, date) && !isCovered(client, date);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const SALT_CELL_INTERVAL_DAYS = 180;

function isSaltPool(client: CalendarClient): boolean {
  return !!client.pool_type && /salt/i.test(client.pool_type);
}

export function ClientsCalendarView({ clients, adminMode = false }: Props) {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [saltCleanMap, setSaltCleanMap] = useState<Map<string, string>>(new Map());

  // Fetch most recent salt cell cleaning per salt-pool client
  useEffect(() => {
    const saltClientIds = clients.filter(isSaltPool).map(c => c.id);
    if (!saltClientIds.length) { setSaltCleanMap(new Map()); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('services')
        .select('client_id, service_date, actions')
        .in('client_id', saltClientIds)
        .contains('actions', { salt_cell_cleaned: true })
        .order('service_date', { ascending: false });
      if (cancelled || error || !data) return;
      const m = new Map<string, string>();
      data.forEach((row: any) => {
        if (!m.has(row.client_id)) m.set(row.client_id, row.service_date);
      });
      setSaltCleanMap(m);
    })();
    return () => { cancelled = true; };
  }, [clients]);

  function saltCellDueDate(client: CalendarClient): Date | null {
    if (!isSaltPool(client)) return null;
    const last = saltCleanMap.get(client.id);
    if (!last) return startOfDay(new Date(0)); // never cleaned → always due
    const d = startOfDay(new Date(last));
    d.setDate(d.getDate() + SALT_CELL_INTERVAL_DAYS);
    return d;
  }

  function saltCellDueOn(client: CalendarClient, date: Date): boolean {
    const due = saltCellDueDate(client);
    if (!due) return false;
    const d = startOfDay(date);
    const today = startOfDay(new Date());
    // Flag from the due date through today (don't project into future months)
    return d <= today && d >= due;
  }

  const monthGrid = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  const countsByDay = useMemo(() => {
    const map = new Map<string, number>();
    monthGrid.forEach(d => {
      if (!d) return;
      const n = clients.filter(c => clientDueOn(c, d)).length;
      if (n) map.set(d.toDateString(), n);
    });
    return map;
  }, [monthGrid, clients]);

  const scheduledSelected = useMemo(
    () => clients.filter(c => clientScheduledOn(c, selectedDate)),
    [clients, selectedDate]
  );
  const dueSelected = useMemo(
    () => scheduledSelected.filter(c => !isCovered(c, selectedDate)),
    [scheduledSelected, selectedDate]
  );
  const completedSelected = useMemo(
    () => scheduledSelected.filter(c => isCovered(c, selectedDate)),
    [scheduledSelected, selectedDate]
  );

  const today = new Date();
  const monthLabel = viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const { toast } = useToast();
  const [clearingId, setClearingId] = useState<string | null>(null);

  async function clearService(client: CalendarClient) {
    if (!confirm(`Clear the most recent service for ${client.customer}? They will move back to their next scheduled day.`)) return;
    setClearingId(client.id);
    try {
      // Find most recent service record for this client
      const { data: latest, error: latestErr } = await supabase
        .from('services')
        .select('id, service_date')
        .eq('client_id', client.id)
        .order('service_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestErr) throw latestErr;

      if (latest?.id) {
        const { error: delErr } = await supabase.from('services').delete().eq('id', latest.id);
        if (delErr) throw delErr;
      }

      // Recompute last_service_date from remaining services
      const { data: prev } = await supabase
        .from('services')
        .select('service_date')
        .eq('client_id', client.id)
        .order('service_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const newDate = prev?.service_date
        ? String(prev.service_date).split('T')[0]
        : null;

      await supabase
        .from('clients')
        .update({ last_service_date: newDate })
        .eq('id', client.id);

      // Mutate local copy so the UI updates immediately
      client.last_service_date = newDate;

      toast({ title: 'Service cleared', description: `${client.customer} moved back to next scheduled day.` });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Failed to clear service', variant: 'destructive' });
    } finally {
      setClearingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" /> {monthLabel}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => { const t = new Date(); setViewMonth(new Date(t.getFullYear(), t.getMonth(), 1)); setSelectedDate(t); }}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardDescription>Tap a day to see clients scheduled for service</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-1">
            {DAY_SHORT.map((d, i) => <div key={i} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthGrid.map((d, i) => {
              if (!d) return <div key={i} />;
              const count = countsByDay.get(d.toDateString()) || 0;
              const isToday = sameDay(d, today);
              const isSelected = sameDay(d, selectedDate);
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(d)}
                  className={cn(
                    'aspect-square rounded-md border text-sm flex flex-col items-center justify-center gap-0.5 transition-colors',
                    'hover:bg-accent',
                    isSelected && 'bg-primary text-primary-foreground hover:bg-primary border-primary',
                    !isSelected && isToday && 'border-primary',
                    !isSelected && count > 0 && 'bg-accent/40',
                  )}
                >
                  <span className={cn('font-medium', isToday && !isSelected && 'text-primary')}>{d.getDate()}</span>
                  {count > 0 && (
                    <span className={cn(
                      'text-[10px] leading-none px-1.5 py-0.5 rounded-full',
                      isSelected ? 'bg-primary-foreground/20' : 'bg-primary/10 text-primary'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </CardTitle>
          <CardDescription>
            {dueSelected.length} due · {completedSelected.length} completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dueSelected.map((client) => (
              <div key={client.id} className="flex items-center justify-between p-4 border rounded-lg gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{client.customer}</p>
                  {(client.pool_size || client.pool_type) && (
                    <p className="text-sm text-muted-foreground">
                      Pool: {client.pool_size?.toLocaleString()} gal{client.pool_type ? `, ${client.pool_type}` : ''}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Last service: {client.last_service_date
                      ? new Date(client.last_service_date).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {adminMode && (
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/admin/clients/${client.id}`}>
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Link>
                    </Button>
                  )}
                  <Button size="sm" asChild>
                    <Link to={`/tech/service/${client.id}`}>Start Service</Link>
                  </Button>
                </div>
              </div>
            ))}

            {completedSelected.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-medium uppercase text-muted-foreground mb-2">Completed</p>
                <div className="space-y-3">
                  {completedSelected.map((client) => (
                    <div key={client.id} className="flex items-center justify-between p-4 border rounded-lg gap-3 bg-muted/30">
                      <div className="min-w-0">
                        <p className="font-medium truncate flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          {client.customer}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Serviced: {client.last_service_date
                            ? new Date(client.last_service_date).toLocaleDateString()
                            : '—'}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {adminMode && (
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/admin/clients/${client.id}`}>
                              <Eye className="h-3 w-3 mr-1" /> View
                            </Link>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={clearingId === client.id}
                          onClick={() => clearService(client)}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          {clearingId === client.id ? 'Clearing…' : 'Clear'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {scheduledSelected.length === 0 && (
              <p className="text-center text-muted-foreground py-6">No clients scheduled this day</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

