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
  client: any;
  recentServices: any[];
  nextService: any;
  poolStatus: string;
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
      // Load client profile
      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!client) {
        setLoading(false);
        return;
      }

      // Load recent services
      const { data: services } = await supabase
        .from('services')
        .select(`
          *,
          users(name)
        `)
        .eq('client_id', client.id)
        .order('service_date', { ascending: false })
        .limit(5);

      // Load service requests
      const { data: requests } = await supabase
        .from('service_requests')
        .select('*')
        .eq('client_id', client.id)
        .order('requested_date', { ascending: false });

      // Determine pool status
      let poolStatus = 'good';
      if (!client.last_service_date) {
        poolStatus = 'needs_service';
      } else {
        const lastService = new Date(client.last_service_date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (lastService < weekAgo) {
          poolStatus = 'needs_service';
        }
      }

      setDashboardData({
        client,
        recentServices: services || [],
        nextService: null, // Could be calculated based on schedule
        poolStatus,
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

  if (!dashboardData?.client) {
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

  const { client, recentServices, poolStatus, serviceRequests } = dashboardData;

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

      {/* Pool Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Droplets className="h-5 w-5" />
            <span>Pool Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Pool Size</p>
              <p className="text-2xl font-bold">{client.pool_size?.toLocaleString()} gal</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pool Type</p>
              <p className="text-2xl font-bold">{client.pool_type}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex items-center space-x-2">
                {poolStatus === 'good' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                )}
                <Badge variant={poolStatus === 'good' ? 'default' : 'secondary'}>
                  {poolStatus === 'good' ? 'Up to Date' : 'Needs Service'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">Last Service</p>
            <p className="font-medium">
              {client.last_service_date 
                ? new Date(client.last_service_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                : 'No services on record'
              }
            </p>
          </div>
        </CardContent>
      </Card>

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
                    <p className="font-medium">{new Date(service.service_date).toLocaleDateString()}</p>
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
                    <p className="font-medium">{request.request_type}</p>
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