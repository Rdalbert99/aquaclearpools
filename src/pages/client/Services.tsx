import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Calendar, 
  Clock, 
  Droplets, 
  Plus,
  CheckCircle,
  AlertCircle,
  Beaker,
  Brush,
  Filter,
  Thermometer,
  TestTube,
  Wrench
} from 'lucide-react';

interface ServiceHistoryData {
  clients: any[];
  services: any[];
  serviceRequests: any[];
}

const serviceTypes = [
  {
    id: 'routine_cleaning',
    name: 'Routine Pool Cleaning',
    description: 'Complete pool cleaning including skimming, vacuuming, and chemical balancing',
    icon: Droplets,
    estimatedTime: '1-2 hours',
    frequency: 'Weekly/Bi-weekly'
  },
  {
    id: 'chemical_balancing',
    name: 'Chemical Testing & Balancing',
    description: 'Comprehensive water testing and chemical adjustment',
    icon: TestTube,
    estimatedTime: '30-45 minutes',
    frequency: 'Weekly'
  },
  {
    id: 'equipment_maintenance',
    name: 'Equipment Maintenance',
    description: 'Inspection and maintenance of pumps, filters, and other pool equipment',
    icon: Wrench,
    estimatedTime: '1-3 hours',
    frequency: 'Monthly'
  },
  {
    id: 'deep_cleaning',
    name: 'Deep Pool Cleaning',
    description: 'Thorough cleaning including tile scrubbing, filter cleaning, and shock treatment',
    icon: Brush,
    estimatedTime: '2-4 hours',
    frequency: 'Monthly'
  },
  {
    id: 'filter_cleaning',
    name: 'Filter Cleaning/Replacement',
    description: 'Professional filter cleaning or replacement service',
    icon: Filter,
    estimatedTime: '1-2 hours',
    frequency: 'As needed'
  },
  {
    id: 'algae_treatment',
    name: 'Algae Treatment',
    description: 'Specialized treatment for algae removal and prevention',
    icon: Beaker,
    estimatedTime: '2-3 hours',
    frequency: 'As needed'
  },
  {
    id: 'heater_service',
    name: 'Pool Heater Service',
    description: 'Heater inspection, cleaning, and maintenance',
    icon: Thermometer,
    estimatedTime: '1-2 hours',
    frequency: 'Seasonal'
  },
  {
    id: 'emergency_service',
    name: 'Emergency Service',
    description: 'Urgent pool issues requiring immediate attention',
    icon: AlertCircle,
    estimatedTime: 'Variable',
    frequency: 'As needed'
  }
];

export default function ClientServices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<ServiceHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedPool, setSelectedPool] = useState<string>('');
  const [requestDescription, setRequestDescription] = useState('');
  const [priority, setPriority] = useState<string>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadServiceData();
  }, [user]);

  const loadServiceData = async () => {
    if (!user?.id) return;

    try {
      // Load client profiles
      const { data: clients, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('customer');

      if (clientError) throw clientError;

      if (!clients || clients.length === 0) {
        setLoading(false);
        return;
      }

      const clientIds = clients.map(c => c.id);

      // Load services
      const { data: services } = await supabase
        .from('services')
        .select(`
          *,
          users(name),
          clients(customer)
        `)
        .in('client_id', clientIds)
        .order('service_date', { ascending: false });

      // Load service requests
      const { data: serviceRequests } = await supabase
        .from('service_requests')
        .select(`
          *,
          clients(customer)
        `)
        .in('client_id', clientIds)
        .order('requested_date', { ascending: false });

      setData({
        clients: clients || [],
        services: services || [],
        serviceRequests: serviceRequests || []
      });
    } catch (error) {
      console.error('Error loading service data:', error);
      toast({
        title: "Error",
        description: "Failed to load service data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleServiceRequest = async () => {
    if (!selectedService || !selectedPool || !requestDescription.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      const serviceType = serviceTypes.find(s => s.id === selectedService);
      
      const { error } = await supabase
        .from('service_requests')
        .insert({
          client_id: selectedPool,
          request_type: serviceType?.name || selectedService,
          description: requestDescription,
          priority: priority,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Service request submitted successfully"
      });

      // Reset form and close dialog
      setSelectedService('');
      setSelectedPool('');
      setRequestDescription('');
      setPriority('medium');
      setDialogOpen(false);
      
      // Reload data
      loadServiceData();
    } catch (error) {
      console.error('Error submitting service request:', error);
      toast({
        title: "Error",
        description: "Failed to submit service request",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'pending': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!data?.clients || data.clients.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">No Pool Properties Found</h2>
            <p className="text-muted-foreground mb-6">
              Please contact your pool service provider to set up your pool profile.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { clients, services, serviceRequests } = data;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pool Services</h1>
          <p className="text-muted-foreground">Manage your pool services and schedule new appointments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Schedule Service
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Schedule Pool Service</DialogTitle>
              <DialogDescription>
                Select a service type and provide details for your pool service request
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="pool">Select Pool *</Label>
                <Select value={selectedPool} onValueChange={setSelectedPool}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a pool..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.customer} - {client.pool_size?.toLocaleString()} gal {client.pool_type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="service">Service Type *</Label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a service..." />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedService && (
                <div className="p-4 bg-muted rounded-lg">
                  {(() => {
                    const service = serviceTypes.find(s => s.id === selectedService);
                    if (!service) return null;
                    const IconComponent = service.icon;
                    return (
                      <div className="flex items-start space-x-3">
                        <IconComponent className="h-5 w-5 mt-1 text-primary" />
                        <div>
                          <h4 className="font-medium">{service.name}</h4>
                          <p className="text-sm text-muted-foreground">{service.description}</p>
                          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                            <span>⏱️ {service.estimatedTime}</span>
                            <span>📅 {service.frequency}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Routine service</SelectItem>
                    <SelectItem value="medium">Medium - Standard request</SelectItem>
                    <SelectItem value="high">High - Urgent attention needed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Service Details *</Label>
                <Textarea
                  id="description"
                  placeholder="Please describe what you need or any specific concerns about your pool..."
                  value={requestDescription}
                  onChange={(e) => setRequestDescription(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleServiceRequest} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="available" className="space-y-6">
        <TabsList>
          <TabsTrigger value="available">Available Services</TabsTrigger>
          <TabsTrigger value="history">Service History</TabsTrigger>
          <TabsTrigger value="requests">Service Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="available">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {serviceTypes.map((service) => {
              const IconComponent = service.icon;
              return (
                <Card key={service.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <IconComponent className="h-5 w-5 text-primary" />
                      <span>{service.name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="mb-4">
                      {service.description}
                    </CardDescription>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Estimated Time:</span>
                        <span>{service.estimatedTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frequency:</span>
                        <span>{service.frequency}</span>
                      </div>
                    </div>
                    <Button 
                      className="w-full mt-4" 
                      variant="outline"
                      onClick={() => {
                        setSelectedService(service.id);
                        setDialogOpen(true);
                      }}
                    >
                      Request This Service
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Service History</span>
              </CardTitle>
              <CardDescription>
                Complete history of all pool services performed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {services.map((service: any) => (
                  <div key={service.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <p className="font-medium">
                          {clients.length > 1 ? `${service.clients?.customer} - ` : ''}
                          {new Date(service.service_date).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Technician: {service.users?.name || 'Unknown'}
                      </p>
                      {service.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{service.notes}</p>
                      )}
                      {service.chemicals_added && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Chemicals: {service.chemicals_added}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant={getStatusColor(service.status)}>
                        {service.status}
                      </Badge>
                      {service.cost && (
                        <p className="text-sm font-medium mt-1">${service.cost}</p>
                      )}
                      {service.duration && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {service.duration} min
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {services.length === 0 && (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No service history yet</p>
                    <p className="text-sm text-muted-foreground">Your completed services will appear here</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Service Requests</span>
              </CardTitle>
              <CardDescription>
                Track your pending and scheduled service requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {serviceRequests.map((request: any) => (
                  <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <p className="font-medium">
                          {clients.length > 1 ? `${request.clients?.customer} - ` : ''}
                          {request.request_type}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">{request.description}</p>
                      <p className="text-sm text-muted-foreground">
                        Requested: {new Date(request.requested_date).toLocaleDateString()}
                      </p>
                      {request.completed_date && (
                        <p className="text-sm text-muted-foreground">
                          Completed: {new Date(request.completed_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant={getStatusColor(request.status)}>
                        {request.status}
                      </Badge>
                      <Badge variant="outline" className="ml-2">
                        {request.priority}
                      </Badge>
                    </div>
                  </div>
                ))}
                {serviceRequests.length === 0 && (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No service requests yet</p>
                    <p className="text-sm text-muted-foreground">Schedule a service to get started</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}