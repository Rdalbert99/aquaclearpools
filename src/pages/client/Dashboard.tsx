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
  Clock, 
  CheckCircle,
  AlertCircle,
  Plus,
  FileText
} from 'lucide-react';

interface ClientDashboardData {
  clients: any[];
  recentServices: any[];
  serviceRequests: any[];
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<ClientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user?.id) return;

    try {
      // Load client profiles (user can have multiple pools)
      const { data: clients, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('customer');

      if (clientError) {
        console.error('Error loading clients:', clientError);
        setLoading(false);
        return;
      }

      if (!clients || clients.length === 0) {
        setLoading(false);
        return;
      }

      // Load recent services for all client pools
      const clientIds = clients.map(c => c.id);
      const { data: services } = await supabase
        .from('services')
        .select(`
          *,
          users(name),
          clients(customer)
        `)
        .in('client_id', clientIds)
        .order('service_date', { ascending: false })
        .limit(10);

      // Load service requests for all client pools
      const { data: requests } = await supabase
        .from('service_requests')
        .select(`
          *,
          clients(customer)
        `)
        .in('client_id', clientIds)
        .order('requested_date', { ascending: false });

      setDashboardData({
        clients: clients || [],
        recentServices: services || [],
        serviceRequests: requests || []
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!dashboardData?.clients || dashboardData.clients.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Welcome to Pool Management</h2>
            <p className="text-muted-foreground mb-6">
              It looks like your client profile hasn't been set up yet. Please contact your pool service provider to complete your profile setup.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { clients, recentServices, serviceRequests } = dashboardData;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {user?.name}</h1>
          <p className="text-muted-foreground">Here's your pool status and recent activity</p>
        </div>
        <div className="flex space-x-2">
          <Button asChild>
            <Link to="/client/request-service">
              <Plus className="mr-2 h-4 w-4" />
              Request Service
            </Link>
          </Button>
        </div>
      </div>

      {/* Pool Properties */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Your Pool Properties</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client: any) => {
            // Determine pool status
            let poolStatus = 'good';
            let statusText = 'Up to Date';
            if (!client.last_service_date) {
              poolStatus = 'needs_service';
              statusText = 'Needs Service';
            } else {
              const lastService = new Date(client.last_service_date);
              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);
              if (lastService < weekAgo) {
                poolStatus = 'needs_service';
                statusText = 'Needs Service';
              }
            }

            return (
              <Card key={client.id}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Droplets className="h-5 w-5" />
                    <span>{client.customer}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Size</p>
                        <p className="font-medium">{client.pool_size?.toLocaleString()} gal</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Type</p>
                        <p className="font-medium">{client.pool_type}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Status</p>
                      <div className="flex items-center space-x-2">
                        {poolStatus === 'good' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                        )}
                        <Badge variant={poolStatus === 'good' ? 'default' : 'secondary'}>
                          {statusText}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Last Service</p>
                      <p className="text-sm font-medium">
                        {client.last_service_date 
                          ? new Date(client.last_service_date).toLocaleDateString()
                          : 'No services on record'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Services */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Recent Services</span>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/client/services">View All</Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentServices.map((service: any) => (
                <div key={service.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{service.clients?.customer} - {new Date(service.service_date).toLocaleDateString()}</p>
                    <p className="text-sm text-muted-foreground">
                      Technician: {service.users?.name || 'Unknown'}
                    </p>
                    {service.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{service.notes}</p>
                    )}
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
              {recentServices.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No recent services</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Service Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Service Requests</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {serviceRequests.slice(0, 3).map((request: any) => (
                <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{request.clients?.customer} - {request.request_type}</p>
                    <p className="text-sm text-muted-foreground">{request.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(request.requested_date).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge 
                    variant={
                      request.status === 'completed' ? 'default' :
                      request.status === 'in_progress' ? 'secondary' : 'outline'
                    }
                  >
                    {request.status}
                  </Badge>
                </div>
              ))}
              {serviceRequests.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No service requests</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/client/request-service">
                <Plus className="h-6 w-6 mb-2" />
                Request Service
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/client/services">
                <FileText className="h-6 w-6 mb-2" />
                Service History
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/client/profile">
                <Calendar className="h-6 w-6 mb-2" />
                Manage Profile
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}