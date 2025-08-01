import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  Calendar, 
  Droplets, 
  AlertTriangle, 
  Clock,
  CheckCircle,
  Plus,
  MapPin
} from 'lucide-react';

interface DashboardStats {
  assignedServices: any[];
  pendingRequests: any[];
  clientsNeedingService: any[];
}

export default function TechDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load services assigned to this tech
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          clients(customer, pool_size, pool_type),
          users(name)
        `)
        .eq('technician_id', user?.id)
        .order('service_date', { ascending: false })
        .limit(10);

      if (servicesError) {
        console.error('Services error:', servicesError);
      }

      // Load pending service requests (both assigned to this tech and unassigned)
      const { data: requests, error: requestsError } = await supabase
        .from('service_requests')
        .select(`
          *,
          clients(*)
        `)
        .eq('status', 'pending')
        .or(`assigned_technician_id.eq.${user?.id},assigned_technician_id.is.null`);

      if (requestsError) {
        console.error('Requests error:', requestsError);
      }

      // Load clients needing service (from admin view, but filtered for this tech)
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*');

      if (clientsError) {
        console.error('Clients error:', clientsError);
      }

      // Filter clients that need service (haven't been serviced in a week)
      const clientsNeedingService = clients?.filter(c => {
        if (!c.last_service_date) return true;
        const lastService = new Date(c.last_service_date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return lastService < weekAgo;
      }) || [];

      const statsData = {
        assignedServices: services || [],
        pendingRequests: requests || [],
        clientsNeedingService: clientsNeedingService
      };

      setStats(statsData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
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
          <h1 className="text-3xl font-bold">Field Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user?.name}</p>
        </div>
        <div className="flex space-x-2">
          <Button asChild>
            <Link to="/tech/calculator">
              <Droplets className="mr-2 h-4 w-4" />
              Chemical Calculator
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Field Tools</CardTitle>
          <CardDescription>Tools for pool service work</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/tech/calculator">
                <Droplets className="h-6 w-6 mb-2" />
                Chemical Calculator
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/tech/services/new">
                <Plus className="h-6 w-6 mb-2" />
                Record New Service
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Service Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Pending Requests</span>
            </CardTitle>
            <CardDescription>Service requests from potential and existing customers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.pendingRequests.map((request: any) => (
                <div key={request.id} className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    <div>
                      <p className="font-medium">
                        {request.contact_name || request.clients?.customer || 'Unknown'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {request.contact_email || 'No email'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm">
                        <MapPin className="inline h-3 w-3 mr-1" />
                        {request.contact_address || 'No address'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {request.contact_phone || 'No phone'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{request.request_type}</p>
                      <p className="text-sm text-muted-foreground">
                        {request.pool_type && request.pool_size ? 
                          `${request.pool_type} - ${request.pool_size}` : 
                          'Pool details not specified'
                        }
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={request.priority === 'high' || request.priority === 'emergency' ? 'destructive' : 'secondary'}>
                        {request.priority} priority
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {new Date(request.requested_date).toLocaleDateString()}
                      </p>
                      <Button size="sm" asChild>
                        <Link to={`/admin/service-request/${request.id}`}>
                          View Details
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {stats?.pendingRequests.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No pending requests</p>
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
                  </div>
                  <div>
                    <Button size="sm" asChild>
                      <Link to={`/tech/service/${client.id}`}>
                        Start Service
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

      {/* Recent Services */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5" />
            <span>My Recent Services</span>
          </CardTitle>
          <CardDescription>Services you've completed recently</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats?.assignedServices.slice(0, 5).map((service: any) => (
              <div key={service.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{service.clients?.customer || 'Unknown Client'}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(service.service_date).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Duration: {service.duration ? `${service.duration} min` : 'Not recorded'}
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
            {stats?.assignedServices.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No recent services</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}