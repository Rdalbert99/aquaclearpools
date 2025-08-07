import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  Users, 
  Calendar, 
  Droplets, 
  AlertTriangle, 
  TrendingUp,
  Clock,
  CheckCircle,
  Plus
} from 'lucide-react';

interface DashboardStats {
  totalClients: number;
  activeServices: number;
  pendingRequests: number;
  recentServices: any[];
  clientsNeedingService: any[];
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    
    // Force loading to false after 5 seconds to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('Dashboard loading timeout - forcing loading to false');
      setLoading(false);
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, []);

  const loadDashboardData = async () => {
    console.log('Loading dashboard data...');
    try {
      // Load clients
      console.log('Loading clients...');
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*');
      
      if (clientsError) {
        console.error('Clients error:', clientsError);
      } else {
        console.log('Clients loaded:', clients);
      }

      // Load recent services
      console.log('Loading services...');
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          clients(customer),
          users(name)
        `)
        .order('service_date', { ascending: false })
        .limit(5);

      if (servicesError) {
        console.error('Services error:', servicesError);
      } else {
        console.log('Services loaded:', services);
      }

      // Load pending service requests
      console.log('Loading service requests...');
      const { data: requests, error: requestsError } = await supabase
        .from('service_requests')
        .select(`
          *,
          clients(*)
        `)
        .eq('status', 'pending');

      if (requestsError) {
        console.error('Requests error:', requestsError);
      } else {
        console.log('Requests loaded:', requests);
      }

      // Map clients needing service with their latest service request dates
      const clientsWithRequests = clients?.filter(c => {
        if (!c.last_service_date) return true;
        const lastService = new Date(c.last_service_date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return lastService < weekAgo;
      }).map(client => {
        // Find the most recent service request for this client
        const clientRequests = requests?.filter(r => r.client_id === client.id) || [];
        const latestRequest = clientRequests.sort((a, b) => 
          new Date(b.requested_date).getTime() - new Date(a.requested_date).getTime()
        )[0];
        
        return {
          ...client,
          latest_request_date: latestRequest?.requested_date || null
        };
      }) || [];

      const statsData = {
        totalClients: clients?.length || 0,
        activeServices: services?.filter(s => s.status === 'completed').length || 0,
        pendingRequests: requests?.length || 0,
        recentServices: services || [],
        clientsNeedingService: clientsWithRequests
      };

      console.log('Final stats:', statsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user?.name}</p>
        </div>
        <div className="flex space-x-2">
          <Button asChild>
            <Link to="/admin/services/new">
              <Plus className="mr-2 h-4 w-4" />
              New Service
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {user?.role === 'admin' && (
              <>
                <Button asChild variant="outline" className="h-20 flex-col">
                  <Link to="/admin/clients">
                    <Users className="h-6 w-6 mb-2" />
                    Manage Clients
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-20 flex-col">
                  <Link to="/admin/users/new?role=admin">
                    <Users className="h-6 w-6 mb-2" />
                    Create Admin
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-20 flex-col">
                  <Link to="/admin/users/new?role=tech">
                    <Users className="h-6 w-6 mb-2" />
                    Create Tech
                  </Link>
                </Button>
              </>
            )}
            {(user?.role === 'admin' || user?.role === 'tech') && (
              <Button asChild variant="outline" className="h-20 flex-col">
                <Link to="/admin/users/new?role=client">
                  <Users className="h-6 w-6 mb-2" />
                  Create Customer
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/admin/calculator">
                <Droplets className="h-6 w-6 mb-2" />
                Chemical Calculator
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/admin/services">
                <Calendar className="h-6 w-6 mb-2" />
                Service History
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Services */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Recent Services</span>
            </CardTitle>
            <CardDescription>Latest pool services performed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.recentServices.map((service: any) => (
                <div key={service.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{service.clients?.customer || 'Unknown Client'}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(service.service_date).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Tech: {service.users?.name || 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={service.status === 'completed' ? 'default' : 'secondary'}>
                      {service.status}
                    </Badge>
                    {service.cost && (
                      <p className="text-sm font-medium mt-1">${service.cost}</p>
                    )}
                  </div>
                </div>
              ))}
              {stats?.recentServices.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No recent services</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Clients Needing Service */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <span>Clients Needing Service</span>
              </div>
              <div className="text-3xl font-bold">{stats?.clientsNeedingService.length}</div>
            </CardTitle>
            <CardDescription>Clients who haven't been serviced recently</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.clientsNeedingService.slice(0, 5).map((client: any) => (
                <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{client.customer}</p>
                    <p className="text-sm text-muted-foreground">
                      Pool: {client.pool_size?.toLocaleString()} gal, {client.pool_type}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Last service: {client.last_service_date 
                        ? new Date(client.last_service_date).toLocaleDateString()
                        : 'Never'
                      }
                    </p>
                    {client.latest_request_date && (
                      <p className="text-sm text-orange-600 font-medium">
                        Requested: {new Date(client.latest_request_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div>
                    <Button size="sm" asChild>
                      <Link to={`/admin/clients/${client.id}`}>
                        View
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
              {stats?.clientsNeedingService.length === 0 && (
                <p className="text-center text-muted-foreground py-4">All clients up to date!</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}