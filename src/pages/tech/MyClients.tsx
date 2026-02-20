import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Users, ArrowLeft } from 'lucide-react';

export default function MyClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadClients = async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('assigned_technician_id', user?.id)
          .eq('status', 'Active')
          .order('customer', { ascending: true });

        if (error) {
          console.error('Error loading clients:', error);
        } else {
          setClients(data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) loadClients();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/tech"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">My Clients</h1>
            <p className="text-muted-foreground">{clients.length} assigned clients</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Assigned Clients
          </CardTitle>
          <CardDescription>All clients assigned to you — start a service for any client</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {clients.map((client) => (
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
            {clients.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No clients assigned</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
