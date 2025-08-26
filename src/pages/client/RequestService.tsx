import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  ArrowLeft,
  Calendar,
  Droplets,
  CheckCircle,
  Beaker,
  Brush,
  Filter,
  Thermometer,
  TestTube,
  Wrench,
  AlertCircle
} from 'lucide-react';

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

export default function RequestService() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedPool, setSelectedPool] = useState<string>('');
  const [requestDescription, setRequestDescription] = useState('');
  const [priority, setPriority] = useState<string>('medium');

  useEffect(() => {
    loadClients();
  }, [user]);

  const loadClients = async () => {
    if (!user?.id) return;

    try {
      const { data: clients, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('customer');

      if (error) throw error;
      setClients(clients || []);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast({
        title: "Error",
        description: "Failed to load your pool information",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
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
      const selectedClient = clients.find(c => c.id === selectedPool);
      
      const { data: serviceRequest, error } = await supabase
        .from('service_requests')
        .insert({
          client_id: selectedPool,
          request_type: serviceType?.name || selectedService,
          description: requestDescription,
          priority: priority,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // Send email notification
      try {
        await supabase.functions.invoke('send-service-request-email', {
          body: {
            customerData: {
              name: selectedClient?.customer || user?.name || 'Customer',
              email: user?.email || selectedClient?.contact_email || '',
              phone: user?.phone || selectedClient?.contact_phone || '',
              address: selectedClient?.contact_address || '',
              poolType: selectedClient?.pool_type || 'Unknown',
              poolSize: selectedClient?.pool_size ? `${selectedClient.pool_size?.toLocaleString()} gallons` : 'Unknown',
              serviceType: serviceType?.name || selectedService,
              description: requestDescription,
              preferredDate: '',
              urgency: priority
            },
            requestDetails: {
              type: serviceType?.name || selectedService,
              urgency: priority,
              preferredDate: ''
            }
          }
        });
        console.log('Service request email sent successfully');
      } catch (emailError) {
        console.error('Error sending service request email:', emailError);
        // Don't block the user flow if email fails
      }

      toast({
        title: "Success",
        description: "Service request submitted successfully! We'll contact you soon to schedule."
      });

      // Navigate back to client dashboard
      navigate('/client');
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

  if (loading) {
    return <LoadingSpinner />;
  }

  if (clients.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">No Pool Properties Found</h2>
            <p className="text-muted-foreground mb-6">
              Please contact your pool service provider to set up your pool profile.
            </p>
            <Button onClick={() => navigate('/client')}>
              Back to Dashboard
            </Button>
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
          <Button variant="outline" onClick={() => navigate('/client')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Request Pool Service</h1>
            <p className="text-muted-foreground">Schedule a service for your pool</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Request Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Request Details</CardTitle>
              <CardDescription>
                Please provide details about the service you need
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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

              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => navigate('/client')}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Service Information */}
        <div className="space-y-6">
          {selectedService && (
            <Card>
              <CardHeader>
                <CardTitle>Service Information</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const service = serviceTypes.find(s => s.id === selectedService);
                  if (!service) return null;
                  const IconComponent = service.icon;
                  return (
                    <div className="space-y-4">
                      <div className="flex items-start space-x-3">
                        <IconComponent className="h-6 w-6 mt-1 text-primary" />
                        <div>
                          <h3 className="font-semibold text-lg">{service.name}</h3>
                          <p className="text-muted-foreground">{service.description}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div>
                          <h4 className="font-medium mb-2">Estimated Time</h4>
                          <p className="text-sm text-muted-foreground">{service.estimatedTime}</p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Typical Frequency</h4>
                          <p className="text-sm text-muted-foreground">{service.frequency}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {selectedPool && (
            <Card>
              <CardHeader>
                <CardTitle>Pool Information</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const pool = clients.find(c => c.id === selectedPool);
                  if (!pool) return null;
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Droplets className="h-5 w-5 text-primary" />
                        <span className="font-medium">{pool.customer}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Size:</span>
                          <p className="font-medium">{pool.pool_size?.toLocaleString()} gallons</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Type:</span>
                          <p className="font-medium">{pool.pool_type}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Liner:</span>
                          <p className="font-medium">{pool.liner_type}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Service Frequency:</span>
                          <p className="font-medium">{pool.service_frequency}</p>
                        </div>
                      </div>
                      {pool.last_service_date && (
                        <div className="pt-2 border-t">
                          <span className="text-muted-foreground text-sm">Last Service:</span>
                          <p className="font-medium">{new Date(pool.last_service_date).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>What Happens Next?</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">1</div>
                  <div>
                    <p className="font-medium">Request Received</p>
                    <p className="text-sm text-muted-foreground">We'll review your service request immediately</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">2</div>
                  <div>
                    <p className="font-medium">Technician Assignment</p>
                    <p className="text-sm text-muted-foreground">We'll assign a qualified technician to your service</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">3</div>
                  <div>
                    <p className="font-medium">Schedule Confirmation</p>
                    <p className="text-sm text-muted-foreground">We'll contact you to confirm the service appointment</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">4</div>
                  <div>
                    <p className="font-medium">Service Completion</p>
                    <p className="text-sm text-muted-foreground">Professional service with detailed report provided</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}