import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft,
  Calendar,
  User,
  Clock,
  DollarSign,
  TestTube,
  Droplets
} from 'lucide-react';

interface Service {
  id: string;
  service_date: string;
  status: string;
  duration_minutes: number | null;
  cost: number | null;
  ph_level: number | null;
  chlorine_level: number | null;
  alkalinity_level: number | null;
  notes: string | null;
  services_performed: string | null;
  chemicals_added: string | null;
  users?: {
    name: string;
  };
}

interface Client {
  id: string;
  customer: string;
  pool_type: string;
  pool_size: number;
}

export default function ClientServices() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id]);

  const loadData = async (clientId: string) => {
    try {
      // Load client info
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, customer, pool_type, pool_size')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);

      // Load services for this client
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          users!technician_id(name)
        `)
        .eq('client_id', clientId)
        .order('service_date', { ascending: false });

      if (servicesError) throw servicesError;
      setServices(servicesData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load service information",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
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

  if (!client) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-6">
          <Button variant="outline" onClick={() => navigate('/admin/clients')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Button>
        </div>
        <Card>
          <CardContent className="text-center py-8">
            <h3 className="text-lg font-semibold mb-2">Client not found</h3>
            <p className="text-muted-foreground">The requested client could not be found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/admin/clients')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{client.customer} - Service History</h1>
            <p className="text-muted-foreground">
              {client.pool_type} Pool • {client.pool_size?.toLocaleString()} gallons
            </p>
          </div>
        </div>
        <Button asChild>
          <Link to={`/admin/clients/${client.id}`}>
            View Client Details
          </Link>
        </Button>
      </div>

      {/* Services List */}
      <div className="space-y-4">
        {services.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Droplets className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Services Performed</h3>
              <p className="text-muted-foreground mb-4">
                This client hasn't received any services yet.
              </p>
              <Button asChild>
                <Link to="/admin/services/new">
                  Add First Service
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          services.map((service) => (
            <Card key={service.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5" />
                    <span>{new Date(service.service_date).toLocaleDateString()}</span>
                  </CardTitle>
                  <Badge className={getStatusColor(service.status)}>
                    {service.status}
                  </Badge>
                </div>
                {service.users?.name && (
                  <CardDescription className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>Serviced by {service.users.name}</span>
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Service Details */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {service.duration_minutes && (
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Duration</p>
                        <p className="text-sm text-muted-foreground">{service.duration_minutes} min</p>
                      </div>
                    </div>
                  )}
                  
                  {service.cost && (
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Cost</p>
                        <p className="text-sm text-muted-foreground">${service.cost.toFixed(2)}</p>
                      </div>
                    </div>
                  )}

                  {(service.ph_level || service.chlorine_level) && (
                    <div className="flex items-center space-x-2">
                      <TestTube className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Chemical Levels</p>
                        <div className="text-sm text-muted-foreground">
                          {service.ph_level && <p>pH: {service.ph_level}</p>}
                          {service.chlorine_level && <p>Cl: {service.chlorine_level}</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Services Performed */}
                {service.services_performed && (
                  <div>
                    <p className="text-sm font-medium mb-2">Services Performed</p>
                    <p className="text-sm text-muted-foreground">{service.services_performed}</p>
                  </div>
                )}

                {/* Chemicals Added */}
                {service.chemicals_added && (
                  <div>
                    <p className="text-sm font-medium mb-2">Chemicals Added</p>
                    <p className="text-sm text-muted-foreground">{service.chemicals_added}</p>
                  </div>
                )}

                {/* Notes */}
                {service.notes && (
                  <div>
                    <p className="text-sm font-medium mb-2">Notes</p>
                    <p className="text-sm text-muted-foreground">{service.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}