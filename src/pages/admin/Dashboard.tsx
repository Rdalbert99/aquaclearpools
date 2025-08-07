import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Users, 
  Calendar, 
  Droplets, 
  AlertTriangle, 
  TrendingUp,
  Clock,
  CheckCircle,
  Plus,
  FileText,
  Camera
} from 'lucide-react';

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
    console.log('Loading admin dashboard data...');
    try {
      // Load clients with more details
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('customer');
      
      if (clientsError) {
        console.error('Clients error:', clientsError);
      }

      // Load recent services with more details
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          clients(customer, pool_type),
          users(name)
        `)
        .order('service_date', { ascending: false })
        .limit(5);

      if (servicesError) {
        console.error('Services error:', servicesError);
      }

      // Load pending service requests
      const { data: requests, error: requestsError } = await supabase
        .from('service_requests')
        .select(`
          *,
          clients(customer)
        `)
        .eq('status', 'pending');

      if (requestsError) {
        console.error('Requests error:', requestsError);
      }

      // Calculate clients needing service
      const clientsWithRequests = clients?.filter(c => {
        if (!c.last_service_date) return true;
        const lastService = new Date(c.last_service_date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return lastService < weekAgo;
      }) || [];

      const statsData = {
        totalClients: clients?.length || 0,
        activeServices: services?.filter(s => s.status === 'completed').length || 0,
        pendingRequests: requests?.length || 0,
        recentServices: services || [],
        clientsNeedingService: clientsWithRequests,
        allClients: clients || []
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
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalClients}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Services</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeServices}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingRequests}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Need Service</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.clientsNeedingService.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/admin/clients">
                <Users className="h-6 w-6 mb-2" />
                Manage Clients
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/admin/clients/new">
                <Plus className="h-6 w-6 mb-2" />
                New Client
              </Link>
            </Button>
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
        {/* All Clients with Pool Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>All Clients</span>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/clients">View All</Link>
              </Button>
            </CardTitle>
            <CardDescription>Client pool information and status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.allClients.slice(0, 5).map((client: any) => {
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
                  <div key={client.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{client.customer}</h4>
                        <p className="text-sm text-muted-foreground">
                          {client.pool_size?.toLocaleString()} gal • {client.pool_type}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {poolStatus === 'good' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                        )}
                        <Badge variant={poolStatus === 'good' ? 'default' : 'secondary'}>
                          {statusText}
                        </Badge>
                      </div>
                    </div>
                    
                    {client.pool_image_url && (
                      <div className="mb-3">
                        <img 
                          src={client.pool_image_url} 
                          alt={`${client.customer} pool`}
                          className="w-full h-32 object-cover rounded"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Updated: {new Date(client.pool_image_uploaded_at || client.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Last Service</p>
                        <p className="font-medium">
                          {client.last_service_date 
                            ? new Date(client.last_service_date).toLocaleDateString()
                            : 'Never'
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Frequency</p>
                        <p className="font-medium capitalize">{client.service_frequency}</p>
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <Button size="sm" asChild>
                        <Link to={`/admin/clients/${client.id}`}>
                          View Details
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
              {stats?.allClients.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No clients found</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Services Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Recent Services</span>
            </CardTitle>
            <CardDescription>Latest pool services with details</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentServices.length > 0 ? (
              <div className="space-y-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Tech</TableHead>
                      <TableHead className="text-center">pH</TableHead>
                      <TableHead className="text-center">Chlorine</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentServices.map((service: any) => (
                      <TableRow key={service.id}>
                        <TableCell className="font-medium">
                          {new Date(service.service_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{service.clients?.customer || 'Unknown'}</TableCell>
                        <TableCell>{service.users?.name || 'Unknown'}</TableCell>
                        <TableCell className="text-center">
                          {service.ph_level ? service.ph_level : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {service.chlorine_level ? `${service.chlorine_level} ppm` : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={service.status === 'completed' ? 'default' : 'secondary'}>
                            {service.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Service Details */}
                <div className="space-y-3">
                  <h4 className="font-medium">Service Details</h4>
                  {stats.recentServices.slice(0, 3).map((service: any) => (
                    <Card key={`details-${service.id}`} className="border-l-4 border-l-primary">
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-medium">
                            {service.clients?.customer} - {new Date(service.service_date).toLocaleDateString()}
                          </h5>
                          {service.cost && (
                            <span className="text-sm font-medium">${service.cost}</span>
                          )}
                        </div>
                        
                        {service.services_performed && (
                          <div className="mb-2">
                            <p className="text-sm font-medium text-muted-foreground">Services:</p>
                            <p className="text-sm">{service.services_performed}</p>
                          </div>
                        )}

                        {service.chemicals_added && (
                          <div className="mb-2">
                            <p className="text-sm font-medium text-muted-foreground">Chemicals:</p>
                            <p className="text-sm">{service.chemicals_added}</p>
                          </div>
                        )}

                        {service.notes && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Notes:</p>
                            <p className="text-sm">{service.notes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No recent services</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}