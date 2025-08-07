import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ReviewForm } from '@/components/reviews/ReviewForm';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Calendar, 
  Droplets, 
  Clock, 
  CheckCircle,
  AlertCircle,
  Plus,
  FileText,
  Star,
  Camera
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
          clients(customer, pool_type)
        `)
        .in('client_id', clientIds)
        .order('service_date', { ascending: false })
        .limit(5);

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

  // Check if this is a multi-property client
  const isMultiProperty = clients.some(client => client.is_multi_property);
  const hasCompany = clients.some(client => client.company_name);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {user?.name}</h1>
          <p className="text-muted-foreground">
            {hasCompany && clients[0]?.company_name 
              ? `Managing ${clients[0].company_name} properties` 
              : "Here's your pool status and recent activity"
            }
          </p>
        </div>
      </div>

      {/* Quick Actions - Moved to top */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button asChild className="h-16 flex-col">
              <Link to="/client/request-service">
                <Plus className="h-6 w-6 mb-2" />
                Request Service
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-16 flex-col">
              <Link to="/client/services">
                <FileText className="h-6 w-6 mb-2" />
                Service History
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-16 flex-col">
              <Link to="/client/profile">
                <Calendar className="h-6 w-6 mb-2" />
                Manage Profile
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Service Requests - Moved to top */}
      {serviceRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>Upcoming Service Requests</span>
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conditional Pool Properties Display */}
      {isMultiProperty && (
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
      )}

      {/* Pool Pictures Section */}
      {!isMultiProperty && clients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Camera className="h-5 w-5" />
              <span>Pool Picture</span>
            </CardTitle>
            <CardDescription>Current view of your pool</CardDescription>
          </CardHeader>
          <CardContent>
            {clients[0].pool_image_url ? (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden">
                  <img 
                    src={clients[0].pool_image_url} 
                    alt="Current pool view"
                    className="w-full h-64 object-cover"
                  />
                </div>
                {clients[0].pool_image_uploaded_at && (
                  <p className="text-sm text-muted-foreground">
                    Last updated: {new Date(clients[0].pool_image_uploaded_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 bg-muted rounded-lg">
                <div className="text-center">
                  <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Pool picture will be uploaded during your first service visit
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Services - Service History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Last 5 Service Visits</span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/client/services">View All</Link>
            </Button>
          </CardTitle>
          <CardDescription>
            Complete service history with water chemistry and maintenance details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentServices.length > 0 ? (
            <div className="space-y-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Technician</TableHead>
                    <TableHead className="text-center">Chlorine</TableHead>
                    <TableHead className="text-center">pH</TableHead>
                    <TableHead className="text-center">Alkalinity</TableHead>
                    {clients[0]?.pool_type?.toLowerCase().includes('salt') && (
                      <TableHead className="text-center">Salinity</TableHead>
                    )}
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentServices.map((service: any) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">
                        {new Date(service.service_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{service.users?.name || 'Unknown'}</TableCell>
                      <TableCell className="text-center">
                        {service.chlorine_level ? `${service.chlorine_level} ppm` : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {service.ph_level ? service.ph_level : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {service.alkalinity_level ? `${service.alkalinity_level} ppm` : '-'}
                      </TableCell>
                      {clients[0]?.pool_type?.toLowerCase().includes('salt') && (
                        <TableCell className="text-center">
                          {service.cyanuric_acid_level ? `${service.cyanuric_acid_level} ppm` : '-'}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant={service.status === 'completed' ? 'default' : 'secondary'}>
                          {service.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Service Details Cards */}
              <div className="space-y-4">
                <h4 className="font-medium">Service Details</h4>
                {recentServices.map((service: any) => (
                  <Card key={`details-${service.id}`} className="border-l-4 border-l-primary">
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-3">
                        <h5 className="font-medium">
                          {new Date(service.service_date).toLocaleDateString()} - {service.users?.name}
                        </h5>
                        {service.cost && (
                          <span className="text-sm font-medium">${service.cost}</span>
                        )}
                      </div>
                      
                      {/* Actions Taken */}
                      {service.services_performed && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-muted-foreground mb-1">Actions Taken:</p>
                          <p className="text-sm">{service.services_performed}</p>
                        </div>
                      )}

                      {/* Maintenance Activities */}
                      <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                        <div>
                          <p className="font-medium text-muted-foreground">Maintenance:</p>
                          <div className="space-y-1">
                            <p>• Pool vacuumed</p>
                            <p>• Surfaces brushed</p>
                            <p>• Skimmers emptied</p>
                          </div>
                        </div>
                        {service.chemicals_added && (
                          <div>
                            <p className="font-medium text-muted-foreground">Chemicals Added:</p>
                            <p>{service.chemicals_added}</p>
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      {service.notes && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Notes:</p>
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
              <p className="text-muted-foreground">No service history available yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your service history will appear here after your first visit
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Form */}
      {clients.length > 0 && (
        <ReviewForm 
          clientId={clients[0].id}
          onSuccess={() => {
            // Optionally refresh data or show success message
          }}
        />
      )}
    </div>
  );
}