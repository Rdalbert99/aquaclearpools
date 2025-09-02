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
  AlertCircle,
  CheckCircle,
  Plus,
  Settings,
  BarChart3,
  FileText,
  Shield,
  MessageSquare
} from 'lucide-react';
import { PoolImageUpload } from '@/components/admin/PoolImageUpload';

interface DashboardStats {
  totalClients: number;
  activeServices: number;
  pendingRequests: number;
  recentServices: any[];
  clientsNeedingService: any[];
  allClients: any[];
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load clients
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('customer');

      if (clientsError) throw clientsError;

      // Load services
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          clients(customer),
          users(name)
        `)
        .order('service_date', { ascending: false })
        .limit(10);

      if (servicesError) throw servicesError;

      // Load service requests
      const { data: requests, error: requestsError } = await supabase
        .from('service_requests')
        .select('*')
        .eq('status', 'pending');

      if (requestsError) throw requestsError;

      // Calculate clients needing service (last service > 7 days ago)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const clientsNeedingService = clients?.filter(client => {
        if (!client.last_service_date) return true;
        return new Date(client.last_service_date) < weekAgo;
      }) || [];

      setStats({
        totalClients: clients?.length || 0,
        activeServices: services?.length || 0,
        pendingRequests: requests?.length || 0,
        recentServices: services || [],
        clientsNeedingService,
        allClients: clients || []
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.name}. Here's your business overview.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/services/new">
            <Plus className="h-4 w-4 mr-2" />
            New Service
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Link to="/admin/clients">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalClients || 0}</div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/services">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Services</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeServices || 0}</div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/service-request-management">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pendingRequests || 0}</div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/clients">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Need Service</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.clientsNeedingService?.length || 0}</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button asChild variant="outline" className="h-16 flex-col">
                <Link to="/admin/clients">
                  <Users className="h-5 w-5 mb-1" />
                  <span className="text-sm">Manage Clients</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-16 flex-col">
                <Link to="/admin/clients/new">
                  <Plus className="h-5 w-5 mb-1" />
                  <span className="text-sm">Add Client</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-16 flex-col">
                <Link to="/admin/admins">
                  <Shield className="h-5 w-5 mb-1" />
                  <span className="text-sm">Manage Admins</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-16 flex-col">
                <Link to="/admin/users/new?role=admin">
                  <Plus className="h-5 w-5 mb-1" />
                  <span className="text-sm">Add Admin</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-16 flex-col">
                <Link to="/admin/techs">
                  <Settings className="h-5 w-5 mb-1" />
                  <span className="text-sm">Manage Techs</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-16 flex-col">
                <Link to="/admin/users/new?role=tech">
                  <Plus className="h-5 w-5 mb-1" />
                  <span className="text-sm">Add Tech</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-16 flex-col">
                <Link to="/admin/calculator">
                  <BarChart3 className="h-5 w-5 mb-1" />
                  <span className="text-sm">Calculator</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-16 flex-col">
                <Link to="/admin/services">
                  <FileText className="h-5 w-5 mb-1" />
                  <span className="text-sm">Service History</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-16 flex-col">
                <Link to="/admin/sms-test">
                  <MessageSquare className="h-5 w-5 mb-1" />
                  <span className="text-sm">SMS Test</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Client Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Client Overview</span>
            </CardTitle>
            <CardDescription>Top 5 clients and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.allClients?.slice(0, 5).map((client: any) => {
                const needsService = !client.last_service_date || 
                  new Date(client.last_service_date) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                
                return (
                  <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{client.customer}</p>
                      <p className="text-sm text-muted-foreground">
                        {client.pool_size?.toLocaleString()} gal • {client.pool_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last service: {client.last_service_date 
                          ? new Date(client.last_service_date).toLocaleDateString()
                          : 'Never'
                        }
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {needsService ? (
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      <Badge variant={needsService ? 'secondary' : 'default'}>
                        {needsService ? 'Needs Service' : 'Good'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              
              {(!stats?.allClients || stats.allClients.length === 0) && (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No clients found</p>
                  <p className="text-sm text-muted-foreground">Add your first client to get started</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pool Image Upload */}
      <PoolImageUpload />

      {/* Recent Services Table */}
      {stats?.recentServices && stats.recentServices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Recent Services</span>
            </CardTitle>
            <CardDescription>Latest service activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentServices.slice(0, 3).map((service: any) => (
                <div key={service.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{service.clients?.customer}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(service.service_date).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      by {service.users?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-4 text-sm">
                      {service.ph_level && (
                        <span>pH: {service.ph_level}</span>
                      )}
                      {service.chlorine_level && (
                        <span>Cl: {service.chlorine_level}</span>
                      )}
                    </div>
                    <Badge variant={service.status === 'completed' ? 'default' : 'secondary'}>
                      {service.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}