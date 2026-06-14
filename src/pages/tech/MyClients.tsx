import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Users, ArrowLeft, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Client {
  id: string;
  customer: string;
  pool_size: number | null;
  pool_type: string | null;
  last_service_date: string | null;
  service_days: string[] | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function clientScheduledOn(client: Client, date: Date): boolean {
  if (!client.service_days?.length) return false;
  const dayName = DAY_NAMES[date.getDay()].toLowerCase();
  const short = dayName.slice(0, 3);
  return client.service_days.some(d => {
    const v = (d || '').toLowerCase();
    return v === dayName || v === short || v.startsWith(short);
  });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function MyClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  useEffect(() => {
    const loadClients = async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('assigned_technician_id', user?.id)
          .eq('status', 'Active')
          .order('customer', { ascending: true });
        if (error) console.error(error);
        else setClients((data as Client[]) || []);
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) loadClients();
  }, [user?.id]);

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
      const n = clients.filter(c => clientScheduledOn(c, d)).length;
      if (n) map.set(d.toDateString(), n);
    });
    return map;
  }, [monthGrid, clients]);

  const dueSelected = useMemo(
    () => clients.filter(c => clientScheduledOn(c, selectedDate)),
    [clients, selectedDate]
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  const today = new Date();
  const monthLabel = viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/tech"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">My Clients</h1>
          <p className="text-muted-foreground">{clients.length} assigned clients</p>
        </div>
      </div>

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
            {dueSelected.length} client{dueSelected.length === 1 ? '' : 's'} scheduled
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dueSelected.map((client) => (
              <div key={client.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{client.customer}</p>
                  <p className="text-sm text-muted-foreground">
                    Pool: {client.pool_size?.toLocaleString()} gal, {client.pool_type}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Last service: {client.last_service_date
                      ? new Date(client.last_service_date).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
                <Button size="sm" asChild>
                  <Link to={`/tech/service/${client.id}`}>Start Service</Link>
                </Button>
              </div>
            ))}
            {dueSelected.length === 0 && (
              <p className="text-center text-muted-foreground py-6">No clients scheduled this day</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
