import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ArrowLeft } from 'lucide-react';
import { ClientsCalendarView, type CalendarClient } from '@/components/clients/ClientsCalendarView';

export default function MyClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<CalendarClient[]>([]);
  const [loading, setLoading] = useState(true);

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
        else setClients((data as CalendarClient[]) || []);
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) load();
  }, [user?.id]);

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

      <ClientsCalendarView clients={clients} />
    </div>
  );
}
