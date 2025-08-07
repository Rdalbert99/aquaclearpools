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

      setDashboardData({
        client,
        nextService: client.next_service_date,
        lastService: null,
        pendingRequests: []
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
            <h2 className="text-2xl font-bold mb-4">Welcome! Let's Set Up Your Pool</h2>
            <p className="text-muted-foreground mb-6">
              To provide you with the best service, we need some basic information about your pool.
            </p>
            <div className="space-y-2 mb-6">
              <p className="text-sm text-muted-foreground">We need to know:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {!client.pool_size && <Badge variant="outline">Pool Size (gallons)</Badge>}
                {!client.pool_type && <Badge variant="outline">Pool Type (Chlorine/Salt Water)</Badge>}
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
                <Phone className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {user?.name}</h1>
          <p className="text-muted-foreground">
            Here's your pool information and quick actions
          </p>
        </div>
      </div>

      {/* Pool Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Droplets className="h-5 w-5" />
            <span>Your Pool Details</span>
          </CardTitle>
          <CardDescription>Current pool configuration and information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Pool Size</p>
              <p className="text-lg font-semibold">{client.pool_size?.toLocaleString()} gallons</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Water Type</p>
              <p className="text-lg font-semibold">{client.pool_type}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Liner Type</p>
              <p className="text-lg font-semibold">{client.liner_type}</p>
            </div>
          </div>
          
          {client.service_frequency && (
            <div className="mt-6 pt-6 border-t">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Service Frequency</p>
                <p className="text-lg font-semibold capitalize">{client.service_frequency}</p>
              </div>
            </div>
          )}
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

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>What would you like to do today?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button asChild className="h-16 text-left flex-col items-start p-4">
              <Link to="/client/request-service">
                <div className="flex items-center space-x-2 mb-1">
                  <Plus className="h-5 w-5" />
                  <span className="font-semibold">Request Service</span>
                </div>
                <span className="text-sm opacity-80">Schedule a pool service or report an issue</span>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-16 text-left flex-col items-start p-4">
              <Link to="/client/services">
                <div className="flex items-center space-x-2 mb-1">
                  <FileText className="h-5 w-5" />
                  <span className="font-semibold">Service History</span>
                </div>
                <span className="text-sm opacity-80">View past services and chemical readings</span>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-16 text-left flex-col items-start p-4">
              <Link to="/client/profile">
                <div className="flex items-center space-x-2 mb-1">
                  <Calendar className="h-5 w-5" />
                  <span className="font-semibold">Manage Profile</span>
                </div>
                <span className="text-sm opacity-80">Update your contact information and pool details</span>
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-16 text-left flex-col items-start p-4">
              <div className="flex items-center space-x-2 mb-1">
                <Phone className="h-5 w-5" />
                <span className="font-semibold">Contact Support</span>
              </div>
              <span className="text-sm opacity-80">Get help with your pool service needs</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}