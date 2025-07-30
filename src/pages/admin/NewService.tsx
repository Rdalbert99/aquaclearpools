import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Calendar, DollarSign, Clock, TestTube, FlaskConical, Calculator, Wrench } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface Client {
  id: string;
  customer: string;
  pool_size: number;
  pool_type: string;
}

interface User {
  id: string;
  name: string;
  role: string;
}

interface ServiceFormData {
  client_id: string;
  technician_id: string;
  service_date: string;
  duration: number;
  cost: number;
  status: string;
  ph_level: number | null;
  chlorine_level: number | null;
  alkalinity_level: number | null;
  cyanuric_acid_level: number | null;
  calcium_hardness_level: number | null;
  chemicals_added: string;
  services_performed: string[];
  notes: string;
}

interface ChemicalRecommendation {
  chemical: string;
  amount: number;
  unit: string;
  reason: string;
}

export default function NewService() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [recommendations, setRecommendations] = useState<ChemicalRecommendation[]>([]);
  
  const [formData, setFormData] = useState<ServiceFormData>({
    client_id: '',
    technician_id: user?.id || '',
    service_date: new Date().toISOString().split('T')[0],
    duration: 60,
    cost: 0,
    status: 'pending',
    ph_level: null,
    chlorine_level: null,
    alkalinity_level: null,
    cyanuric_acid_level: null,
    calcium_hardness_level: null,
    chemicals_added: '',
    services_performed: [],
    notes: ''
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Load clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, customer, pool_size, pool_type')
        .eq('status', 'Active')
        .order('customer');

      if (clientsError) throw clientsError;

      // Load technicians
      const { data: techsData, error: techsError } = await supabase
        .from('users')
        .select('id, name, role')
        .in('role', ['admin', 'tech'])
        .order('name');

      if (techsError) throw techsError;

      setClients(clientsData || []);
      setTechnicians(techsData || []);
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast({
        title: "Error",
        description: "Failed to load form data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof ServiceFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculateChemicals = async () => {
    const selectedClient = clients.find(c => c.id === formData.client_id);
    if (!selectedClient || !formData.ph_level || !formData.chlorine_level) {
      toast({
        title: "Error",
        description: "Please select a client and enter at least pH and chlorine levels",
        variant: "destructive",
      });
      return;
    }

    setCalculating(true);
    try {
      const testResults = {
        ph_level: formData.ph_level,
        chlorine_level: formData.chlorine_level,
        alkalinity_level: formData.alkalinity_level,
        cyanuric_acid_level: formData.cyanuric_acid_level,
        calcium_hardness_level: formData.calcium_hardness_level
      };

      // Calculate chemical recommendations
      const recommendations: ChemicalRecommendation[] = [];
      
      // pH adjustments
      if (formData.ph_level < 7.2) {
        const amount = Math.round((7.4 - formData.ph_level) * selectedClient.pool_size * 0.0012);
        recommendations.push({
          chemical: "pH Up (Sodium Carbonate)",
          amount,
          unit: "oz",
          reason: `pH is ${formData.ph_level}, target is 7.2-7.6`
        });
      } else if (formData.ph_level > 7.6) {
        const amount = Math.round((formData.ph_level - 7.4) * selectedClient.pool_size * 0.001);
        recommendations.push({
          chemical: "pH Down (Muriatic Acid)",
          amount,
          unit: "oz",
          reason: `pH is ${formData.ph_level}, target is 7.2-7.6`
        });
      }

      // Chlorine adjustments
      if (formData.chlorine_level < 1.0) {
        const amount = Math.round((3.0 - formData.chlorine_level) * selectedClient.pool_size * 0.0013);
        recommendations.push({
          chemical: "Liquid Chlorine",
          amount,
          unit: "oz",
          reason: `Chlorine is ${formData.chlorine_level} ppm, target is 1.0-3.0 ppm`
        });
      }

      // Alkalinity adjustments
      if (formData.alkalinity_level && formData.alkalinity_level < 80) {
        const amount = Math.round((100 - formData.alkalinity_level) * selectedClient.pool_size * 0.0015);
        recommendations.push({
          chemical: "Alkalinity Up (Sodium Bicarbonate)",
          amount,
          unit: "oz",
          reason: `Alkalinity is ${formData.alkalinity_level} ppm, target is 80-120 ppm`
        });
      }

      setRecommendations(recommendations);

      // Save calculation to database
      const { error } = await supabase
        .from('chemical_calculations')
        .insert({
          client_id: selectedClient.id,
          technician_id: user?.id,
          pool_type: selectedClient.pool_type,
          pool_size: selectedClient.pool_size,
          test_results: testResults as any,
          chemical_recommendations: recommendations as any
        });

      if (error) {
        console.error('Error saving calculation:', error);
        toast({
          title: "Warning",
          description: "Calculation completed but couldn't save to history",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Chemical calculation completed and saved",
        });
      }
    } catch (error) {
      console.error('Error calculating chemicals:', error);
      toast({
        title: "Error",
        description: "Failed to calculate chemical recommendations",
        variant: "destructive",
      });
    } finally {
      setCalculating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.client_id) {
      toast({
        title: "Error",
        description: "Please select a client",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const serviceData = {
        ...formData,
        duration: Number(formData.duration),
        cost: Number(formData.cost),
        ph_level: formData.ph_level ? Number(formData.ph_level) : null,
        chlorine_level: formData.chlorine_level ? Number(formData.chlorine_level) : null,
        alkalinity_level: formData.alkalinity_level ? Number(formData.alkalinity_level) : null,
        cyanuric_acid_level: formData.cyanuric_acid_level ? Number(formData.cyanuric_acid_level) : null,
        calcium_hardness_level: formData.calcium_hardness_level ? Number(formData.calcium_hardness_level) : null,
        services_performed: formData.services_performed.join(', ') || null,
      };

      const { error } = await supabase
        .from('services')
        .insert([serviceData]);

      if (error) throw error;

      // Update client's last service date if service is completed
      if (formData.status === 'completed') {
        const { error: updateError } = await supabase
          .from('clients')
          .update({ last_service_date: formData.service_date })
          .eq('id', formData.client_id);

        if (updateError) console.error('Error updating client last service date:', updateError);
      }

      toast({
        title: "Success",
        description: "Service record created successfully"
      });

      navigate('/admin/services');
    } catch (error: any) {
      console.error('Error creating service:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create service record",
        variant: "destructive"
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="outline" onClick={() => navigate('/admin/services')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Services
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Service Record</h1>
          <p className="text-muted-foreground">Create a new pool service record</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Service Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Service Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="client_id">Client *</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(value) => handleInputChange('client_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
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

              <div>
                <Label htmlFor="technician_id">Technician *</Label>
                <Select
                  value={formData.technician_id}
                  onValueChange={(value) => handleInputChange('technician_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.name} ({tech.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="service_date">Service Date *</Label>
                <Input
                  id="service_date"
                  type="date"
                  value={formData.service_date}
                  onChange={(e) => handleInputChange('service_date', e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleInputChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="0"
                    value={formData.duration}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                    placeholder="60"
                  />
                </div>
                <div>
                  <Label htmlFor="cost">Cost ($)</Label>
                  <Input
                    id="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => handleInputChange('cost', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
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
              <CardDescription>Record water test results (optional)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ph_level">pH Level</Label>
                  <Input
                    id="ph_level"
                    type="number"
                    step="0.1"
                    min="0"
                    max="14"
                    value={formData.ph_level || ''}
                    onChange={(e) => handleInputChange('ph_level', e.target.value || null)}
                    placeholder="7.4"
                  />
                </div>
                <div>
                  <Label htmlFor="chlorine_level">Chlorine (ppm)</Label>
                  <Input
                    id="chlorine_level"
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.chlorine_level || ''}
                    onChange={(e) => handleInputChange('chlorine_level', e.target.value || null)}
                    placeholder="3.0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="alkalinity_level">Alkalinity (ppm)</Label>
                  <Input
                    id="alkalinity_level"
                    type="number"
                    min="0"
                    value={formData.alkalinity_level || ''}
                    onChange={(e) => handleInputChange('alkalinity_level', e.target.value || null)}
                    placeholder="100"
                  />
                </div>
                <div>
                  <Label htmlFor="cyanuric_acid_level">Cyanuric Acid (ppm)</Label>
                  <Input
                    id="cyanuric_acid_level"
                    type="number"
                    min="0"
                    value={formData.cyanuric_acid_level || ''}
                    onChange={(e) => handleInputChange('cyanuric_acid_level', e.target.value || null)}
                    placeholder="30"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="calcium_hardness_level">Calcium Hardness (ppm)</Label>
                <Input
                  id="calcium_hardness_level"
                  type="number"
                  min="0"
                  value={formData.calcium_hardness_level || ''}
                  onChange={(e) => handleInputChange('calcium_hardness_level', e.target.value || null)}
                  placeholder="200"
                />
              </div>
              
              <div className="mt-4 space-y-4">
                <Button 
                  type="button"
                  onClick={calculateChemicals}
                  disabled={calculating || !formData.ph_level || !formData.chlorine_level || !formData.client_id}
                  className="w-full"
                >
                  {calculating ? (
                    <LoadingSpinner />
                  ) : (
                    <>
                      <Calculator className="mr-2 h-4 w-4" />
                      Calculate Chemical Recommendations
                    </>
                  )}
                </Button>
                
                {recommendations.length > 0 && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold mb-3 text-sm">Chemical Recommendations:</h4>
                    <div className="space-y-2">
                      {recommendations.map((rec, index) => (
                        <div key={index} className="text-sm p-2 bg-background rounded border">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{rec.chemical}: {rec.amount} {rec.unit}</div>
                              <div className="text-muted-foreground text-xs">{rec.reason}</div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const addition = `${rec.chemical}: ${rec.amount} ${rec.unit}`;
                                const current = formData.chemicals_added;
                                const newValue = current ? `${current}\n${addition}` : addition;
                                handleInputChange('chemicals_added', newValue);
                              }}
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Services Performed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Wrench className="h-5 w-5" />
              <span>Services Performed</span>
            </CardTitle>
            <CardDescription>Check the services that were performed during this visit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                'Chemical Testing & Balancing',
                'Skimming Surface Debris',
                'Emptying Skimmer Baskets',
                'Brushing Pool Walls & Steps',
                'Vacuuming Pool Floor',
                'Cleaning Waterline Tile',
                'Backwashing Filter',
                'Equipment Inspection',
                'Pool Equipment Cleaning',
                'Adding Chlorine/Chemicals',
                'Shock Treatment',
                'Algae Prevention',
                'pH Adjustment',
                'Filter Cleaning',
                'Pump Maintenance'
              ].map((service) => (
                <div key={service} className="flex items-center space-x-2">
                  <Checkbox
                    id={service}
                    checked={formData.services_performed.includes(service)}
                    onCheckedChange={(checked) => {
                      const updatedServices = checked 
                        ? [...formData.services_performed, service]
                        : formData.services_performed.filter(s => s !== service);
                      handleInputChange('services_performed', updatedServices);
                    }}
                  />
                  <Label 
                    htmlFor={service} 
                    className="text-sm font-normal cursor-pointer"
                  >
                    {service}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Additional Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FlaskConical className="h-5 w-5" />
              <span>Additional Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="chemicals_added">Chemicals Added</Label>
              <Textarea
                id="chemicals_added"
                value={formData.chemicals_added}
                onChange={(e) => handleInputChange('chemicals_added', e.target.value)}
                placeholder="List any chemicals added during service (e.g., 2 lbs shock, 1 cup algaecide)"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="notes">Service Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Additional notes about the service, observations, or recommendations"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/services')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving || !formData.client_id}
          >
            {saving ? <LoadingSpinner /> : 'Create Service Record'}
          </Button>
        </div>
      </form>
    </div>
  );
}