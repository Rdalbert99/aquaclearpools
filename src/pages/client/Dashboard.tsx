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
  CheckCircle,
  AlertCircle,
  Plus,
  FileText,
  Camera,
  Phone
} from 'lucide-react';

interface ClientDashboardData {
  client: any;
  nextService: any;
  lastService: any;
  pendingRequests: any[];
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
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (clientError) {
        console.error('Error loading client:', clientError);
        setLoading(false);
        return;
      }

      if (!client) {
        setLoading(false);
        return;
      }

      // Load last service
      const { data: lastService } = await supabase
        .from('services')
        .select(`
          *,
          users(name)
        `)
        .eq('client_id', client.id)
        .order('service_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Load pending service requests
      const { data: requests } = await supabase
        .from('service_requests')
        .select('*')
        .eq('client_id', client.id)
        .in('status', ['pending', 'in_progress'])
        .order('requested_date', { ascending: false });

      setDashboardData({
        client,
        nextService: client.next_service_date,
        lastService: lastService || null,
        pendingRequests: requests || []
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
            <Button asChild>
              <Link to="/contact">
                <Phone className="h-4 w-4 mr-2" />
                Contact Support
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { client } = dashboardData;
  
  // Check if essential pool information is missing
  const missingPoolInfo = !client.pool_size || !client.pool_type || !client.liner_type;
  
  if (missingPoolInfo) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Complete Your Pool Setup</h2>
            <p className="text-muted-foreground mb-6">
              To get started, please provide your pool information including size, type, and liner details. This helps us provide better service.
            </p>
            <div className="space-y-2 mb-6">
              <p className="text-sm text-muted-foreground">Missing information:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {!client.pool_size && <Badge variant="outline">Pool Size</Badge>}
                {!client.pool_type && <Badge variant="outline">Pool Type</Badge>}
                {!client.liner_type && <Badge variant="outline">Liner Type</Badge>}
              </div>
            </div>
            <div className="space-y-3">
              <Button asChild>
                <Link to="/client/profile">
                  <Plus className="h-4 w-4 mr-2" />
                  Update Pool Information
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/contact">
                  <Phone className="h-4 w-4 mr-2" />
                  Contact Support
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { lastService, pendingRequests } = dashboardData;

  // Determine pool status
  let poolStatus = 'good';
  let statusText = 'Up to Date';
  if (!client.last_service_date) {
    poolStatus = 'needs_service';
    statusText = 'Needs Service';
  } else {
    const lastServiceDate = new Date(client.last_service_date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (lastServiceDate < weekAgo) {
      poolStatus = 'needs_service';
      statusText = 'Needs Service';
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {user?.name}</h1>
          <p className="text-muted-foreground">
            Here's your pool status and service information
          </p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Current Status</p>
              <div className="flex items-center space-x-2">
                {poolStatus === 'good' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                )}
                <Badge variant={poolStatus === 'good' ? 'default' : 'secondary'}>
                  {statusText}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Pool Size</p>
              <p className="text-lg font-semibold">{client.pool_size?.toLocaleString()} gallons</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Water Type</p>
              <p className="text-lg font-semibold">{client.pool_type}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pool Picture */}
      {client.pool_image_url && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Camera className="h-5 w-5" />
              <span>Your Pool</span>
            </CardTitle>
            <CardDescription>Current view of your pool</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden">
                <img 
                  src={client.pool_image_url} 
                  alt="Current pool view"
                  className="w-full h-64 object-cover"
                />
              </div>
              {client.pool_image_uploaded_at && (
                <p className="text-sm text-muted-foreground">
                  Last updated: {new Date(client.pool_image_uploaded_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button asChild className="w-full justify-start h-12">
                <Link to="/client/request-service">
                  <Plus className="h-5 w-5 mr-3" />
                  Request Service
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start h-12">
                <Link to="/client/services">
                  <FileText className="h-5 w-5 mr-3" />
                  View Service History
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start h-12">
                <Link to="/client/profile">
                  <Calendar className="h-5 w-5 mr-3" />
                  Manage Profile
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Service Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Service Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Last Service</p>
              <p className="font-medium">
                {client.last_service_date 
                  ? new Date(client.last_service_date).toLocaleDateString()
                  : 'No services on record'
                }
              </p>
              {lastService && (
                <p className="text-sm text-muted-foreground">
                  by {lastService.users?.name}
                </p>
              )}
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground mb-1">Service Frequency</p>
              <p className="font-medium capitalize">{client.service_frequency}</p>
            </div>

            {client.next_service_date && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Next Scheduled Service</p>
                <p className="font-medium">
                  {new Date(client.next_service_date).toLocaleDateString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>Pending Service Requests</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingRequests.map((request: any) => (
                <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{request.request_type}</p>
                    <p className="text-sm text-muted-foreground">{request.description}</p>
                    <p className="text-sm text-muted-foreground">
                      Requested: {new Date(request.requested_date).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge 
                    variant={
                      request.status === 'in_progress' ? 'secondary' : 'outline'
                    }
                  >
                    {request.status === 'in_progress' ? 'In Progress' : 'Pending'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}