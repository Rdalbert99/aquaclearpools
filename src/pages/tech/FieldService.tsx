import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock,
  Droplets,
  TestTube,
  FileText,
  Calculator,
  CheckCircle
} from 'lucide-react';

interface Client {
  id: string;
  customer: string;
  pool_size: number;
  pool_type: string;
  liner_type?: string;
}

interface ServiceData {
  client_id: string;
  technician_id: string;
  service_date: string;
  duration: number;
  cost: number;
  status: string;
  ph_level?: number;
  chlorine_level?: number;
  alkalinity_level?: number;
  cyanuric_acid_level?: number;
  calcium_hardness_level?: number;
  chemicals_added: string;
  notes: string;
  services_performed: string[];
}

const serviceOptions = [
  'Skimmed surface',
  'Emptied skimmer baskets',
  'Cleaned pool walls',
  'Vacuumed pool bottom',
  'Brushed steps & ladders',
  'Tested water chemistry',
  'Added chemicals',
  'Cleaned pool equipment',
  'Checked equipment operation',
  'Backwashed filter'
];

export default function FieldService() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startTime] = useState(new Date());
  const [serviceData, setServiceData] = useState<ServiceData>({
    client_id: clientId || '',
    technician_id: user?.id || '',
    service_date: new Date().toISOString().split('T')[0],
    duration: 0,
    cost: 0,
    status: 'in_progress',
    chemicals_added: '',
    notes: '',
    services_performed: []
  });

  useEffect(() => {
    if (clientId) {
      loadClient();
    }
  }, [clientId]);

  const loadClient = async () => {
    try {
      const { data: clientData, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (error) {
        console.error('Error loading client:', error);
        toast({
          title: "Error",
          description: "Failed to load client information",
          variant: "destructive",
        });
      } else {
        setClient(clientData);
        setServiceData(prev => ({ ...prev, client_id: clientData.id }));
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceToggle = (service: string, checked: boolean) => {
    setServiceData(prev => ({
      ...prev,
      services_performed: checked 
        ? [...prev.services_performed, service]
        : prev.services_performed.filter(s => s !== service)
    }));
  };

  const handleInputChange = (field: keyof ServiceData, value: any) => {
    setServiceData(prev => ({ ...prev, [field]: value }));
  };

  const calculateDuration = () => {
    const endTime = new Date();
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    setServiceData(prev => ({ ...prev, duration }));
  };

  const handleComplete = async () => {
    if (serviceData.services_performed.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one service performed",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    calculateDuration();

    try {
      // Create the service record
      const { data, error } = await supabase
        .from('services')
        .insert({
          ...serviceData,
          status: 'completed',
          services_performed: serviceData.services_performed.join(', ')
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating service:', error);
        toast({
          title: "Error",
          description: "Failed to save service record",
          variant: "destructive",
        });
        return;
      }

      // Update client's last service date
      const { error: updateError } = await supabase
        .from('clients')
        .update({ last_service_date: serviceData.service_date })
        .eq('id', clientId);

      if (updateError) {
        console.error('Error updating client:', updateError);
      }

      // Update any pending service requests for this client
      const { error: requestError } = await supabase
        .from('service_requests')
        .update({ 
          status: 'completed',
          completed_date: new Date().toISOString()
        })
        .eq('client_id', clientId)
        .eq('status', 'pending');

      if (requestError) {
        console.error('Error updating service requests:', requestError);
      }

      toast({
        title: "Success",
        description: "Service completed and recorded successfully",
      });

      navigate('/tech');
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
        <div className="text-center">
          <h1 className="text-2xl font-bold">Client not found</h1>
          <Button onClick={() => navigate('/tech')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Field Service</h1>
          <p className="text-muted-foreground">
            Service for {client.customer} - {client.pool_size?.toLocaleString()} gal {client.pool_type} pool
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => navigate('/tech/calculator')}>
            <Calculator className="mr-2 h-4 w-4" />
            Chemical Calculator
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5" />
              <span>Service Checklist</span>
            </CardTitle>
            <CardDescription>Check off completed tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {serviceOptions.map((service) => (
                <div key={service} className="flex items-center space-x-2">
                  <Checkbox
                    id={service}
                    checked={serviceData.services_performed.includes(service)}
                    onCheckedChange={(checked) => handleServiceToggle(service, checked as boolean)}
                  />
                  <Label htmlFor={service} className="text-sm font-normal">
                    {service}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Water Chemistry */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TestTube className="h-5 w-5" />
              <span>Water Chemistry</span>
            </CardTitle>
            <CardDescription>Record test results (optional)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ph">pH Level</Label>
                <Input
                  id="ph"
                  type="number"
                  step="0.1"
                  min="0"
                  max="14"
                  value={serviceData.ph_level || ''}
                  onChange={(e) => handleInputChange('ph_level', parseFloat(e.target.value))}
                  placeholder="7.2"
                />
              </div>
              <div>
                <Label htmlFor="chlorine">Chlorine (ppm)</Label>
                <Input
                  id="chlorine"
                  type="number"
                  step="0.1"
                  min="0"
                  value={serviceData.chlorine_level || ''}
                  onChange={(e) => handleInputChange('chlorine_level', parseFloat(e.target.value))}
                  placeholder="1.5"
                />
              </div>
              <div>
                <Label htmlFor="alkalinity">Alkalinity (ppm)</Label>
                <Input
                  id="alkalinity"
                  type="number"
                  min="0"
                  value={serviceData.alkalinity_level || ''}
                  onChange={(e) => handleInputChange('alkalinity_level', parseInt(e.target.value))}
                  placeholder="100"
                />
              </div>
              <div>
                <Label htmlFor="cyanuric">Cyanuric Acid (ppm)</Label>
                <Input
                  id="cyanuric"
                  type="number"
                  min="0"
                  value={serviceData.cyanuric_acid_level || ''}
                  onChange={(e) => handleInputChange('cyanuric_acid_level', parseInt(e.target.value))}
                  placeholder="50"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="calcium">Calcium Hardness (ppm)</Label>
                <Input
                  id="calcium"
                  type="number"
                  min="0"
                  value={serviceData.calcium_hardness_level || ''}
                  onChange={(e) => handleInputChange('calcium_hardness_level', parseInt(e.target.value))}
                  placeholder="200"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Service Details</span>
            </CardTitle>
            <CardDescription>Cost and timing information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="cost">Service Cost ($)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={serviceData.cost || ''}
                  onChange={(e) => handleInputChange('cost', parseFloat(e.target.value))}
                  placeholder="75.00"
                />
              </div>
              <div>
                <Label>Service Started</Label>
                <p className="text-sm text-muted-foreground">
                  {startTime.toLocaleTimeString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Additional Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="chemicals">Chemicals Added</Label>
                <Textarea
                  id="chemicals"
                  value={serviceData.chemicals_added}
                  onChange={(e) => handleInputChange('chemicals_added', e.target.value)}
                  placeholder="e.g., 2 lbs chlorine shock, 1 lb pH up..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="notes">Service Notes</Label>
                <Textarea
                  id="notes"
                  value={serviceData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Any additional observations or notes..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate('/tech')}>
          Cancel
        </Button>
        <Button 
          onClick={handleComplete}
          disabled={saving || serviceData.services_performed.length === 0}
          className="min-w-[120px]"
        >
          {saving ? (
            <LoadingSpinner />
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Complete Service
            </>
          )}
        </Button>
      </div>
    </div>
  );
}