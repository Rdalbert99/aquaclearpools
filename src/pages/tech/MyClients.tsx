import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ArrowLeft, Search, MapPin, Phone, Play } from 'lucide-react';
import { ClientsCalendarView, type CalendarClient } from '@/components/clients/ClientsCalendarView';

type ClientRow = CalendarClient & {
  phone?: string | null;
  contact_address?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  address?: string | null;
};

function buildAddress(c: ClientRow): string {
  if (c.contact_address && c.contact_address.trim()) return c.contact_address.trim();
  const parts = [c.street_address, c.city, c.state, c.zip_code].filter(Boolean).join(', ');
  if (parts) return parts;
  return (c.address || '').trim();
}

function mapsHref(address: string): string {
  const q = encodeURIComponent(address);
  const isApple = /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);
  return isApple ? `https://maps.apple.com/?daddr=${q}` : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

export default function MyClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('assigned_technician_id', user?.id)
          .eq('status', 'Active')
          .order('customer', { ascending: true });
        if (error) console.error(error);
        else setClients((data as ClientRow[]) || []);
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) load();
  }, [user?.id]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return clients.filter((c) => {
      const addr = buildAddress(c).toLowerCase();
      return (
        c.customer?.toLowerCase().includes(q) ||
        addr.includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      );
    }).slice(0, 25);
  }, [clients, query]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

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
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Find a customer</CardTitle>
          <CardDescription>Search by name, address, or phone — great for callback requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, address, or phone…"
              className="pl-9"
            />
          </div>

          {query.trim() && (
            <div className="space-y-3">
              {results.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No matches</p>
              )}
              {results.map((c) => {
                const addr = buildAddress(c);
                return (
                  <div key={c.id} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.customer}</p>
                        {(c.pool_size || c.pool_type) && (
                          <p className="text-sm text-muted-foreground">
                            Pool: {c.pool_size?.toLocaleString()} gal{c.pool_type ? `, ${c.pool_type}` : ''}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          Last service: {c.last_service_date
                            ? new Date(c.last_service_date).toLocaleDateString()
                            : 'Never'}
                        </p>
                        {addr ? (
                          <a
                            href={mapsHref(addr)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1 break-words"
                          >
                            <MapPin className="h-3.5 w-3.5 shrink-0" /> {addr}
                          </a>
                        ) : (
                          <p className="text-sm text-muted-foreground italic mt-1">No address on file</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {c.phone && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={`tel:${c.phone}`}><Phone className="h-3.5 w-3.5 mr-1" /> Call</a>
                        </Button>
                      )}
                      <Button size="sm" asChild>
                        <Link to={`/tech/service/${c.id}`}><Play className="h-3.5 w-3.5 mr-1" /> Start Service</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ClientsCalendarView clients={clients} />
    </div>
  );
}
