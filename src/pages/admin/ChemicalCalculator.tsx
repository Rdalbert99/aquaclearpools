import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Droplets, Calculator, AlertTriangle, CheckCircle, Save, Settings } from 'lucide-react';

interface TestResults {
  ph: number;
  chlorine: number;
  alkalinity: number;
  cyanuricAcid: number;
  calciumHardness: number;
  salt: number;
}

interface PoolInfo {
  size: number;
  type: string;
  clientId?: string;
}

interface ChemicalRecommendation {
  chemical: string;
  amount: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

interface CalculationSettings {
  ph: {
    min: number;
    max: number;
    target: number;
    sodaAshRatio: number;
    muriaticAcidRatio: number;
  };
  chlorine: {
    min: number;
    max: number;
    target: number;
    calHypoRatio: number;
  };
  alkalinity: {
    min: number;
    max: number;
    target: number;
    bakingSodaRatio: number;
    muriaticAcidRatio: number;
  };
  cyanuricAcid: {
    min: number;
    max: number;
    target: number;
    stabilizerRatio: number;
  };
  calciumHardness: {
    min: number;
    max: number;
    target: number;
    calciumChlorideRatio: number;
  };
  salt: {
    min: number;
    max: number;
    target: number;
    saltRatio: number;
  };
}

export default function ChemicalCalculator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [poolInfo, setPoolInfo] = useState<PoolInfo>({ size: 0, type: '' });
  const [testResults, setTestResults] = useState<TestResults>({
    ph: 0,
    chlorine: 0,
    alkalinity: 0,
    cyanuricAcid: 0,
    calciumHardness: 0,
    salt: 0
  });
  const [recommendations, setRecommendations] = useState<ChemicalRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [settings, setSettings] = useState<CalculationSettings>({
    ph: { min: 7.2, max: 7.6, target: 7.4, sodaAshRatio: 0.0002, muriaticAcidRatio: 0.0003 },
    chlorine: { min: 1.0, max: 3.0, target: 2.0, calHypoRatio: 0.00013 },
    alkalinity: { min: 80, max: 120, target: 100, bakingSodaRatio: 0.00015, muriaticAcidRatio: 0.0002 },
    cyanuricAcid: { min: 30, max: 50, target: 40, stabilizerRatio: 0.00013 },
    calciumHardness: { min: 150, max: 300, target: 200, calciumChlorideRatio: 0.00012 },
    salt: { min: 2700, max: 3400, target: 3200, saltRatio: 0.000083 }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Load clients for selection
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, customer, pool_size, pool_type')
        .eq('status', 'Active')
        .order('customer');
      
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const calculateRecommendations = (): ChemicalRecommendation[] => {
    const recs: ChemicalRecommendation[] = [];
    const poolVolume = poolInfo.size;

    // pH adjustments
    if (testResults.ph < settings.ph.min) {
      const phIncrease = (settings.ph.target - testResults.ph) * poolVolume * settings.ph.sodaAshRatio;
      recs.push({
        chemical: 'Sodium Carbonate (Soda Ash)',
        amount: `${Math.round(phIncrease * 16)} oz`,
        reason: `pH is too low (${testResults.ph}). Target: ${settings.ph.min}-${settings.ph.max}`,
        priority: 'high'
      });
    } else if (testResults.ph > settings.ph.max) {
      const phDecrease = (testResults.ph - settings.ph.target) * poolVolume * settings.ph.muriaticAcidRatio;
      recs.push({
        chemical: 'Muriatic Acid',
        amount: `${Math.round(phDecrease * 16)} oz`,
        reason: `pH is too high (${testResults.ph}). Target: ${settings.ph.min}-${settings.ph.max}`,
        priority: 'high'
      });
    }

    // Chlorine adjustments
    if (testResults.chlorine < settings.chlorine.min) {
      const chlorineNeeded = (settings.chlorine.target - testResults.chlorine) * poolVolume * settings.chlorine.calHypoRatio;
      recs.push({
        chemical: 'Calcium Hypochlorite (Cal-Hypo)',
        amount: `${Math.round(chlorineNeeded * 16)} oz`,
        reason: `Free chlorine is too low (${testResults.chlorine} ppm). Target: ${settings.chlorine.min}-${settings.chlorine.max} ppm`,
        priority: 'high'
      });
    } else if (testResults.chlorine > 5.0) {
      recs.push({
        chemical: 'None - Allow natural dissipation',
        amount: 'Wait 24-48 hours',
        reason: `Free chlorine is too high (${testResults.chlorine} ppm). Target: ${settings.chlorine.min}-${settings.chlorine.max} ppm`,
        priority: 'medium'
      });
    }

    // Alkalinity adjustments
    if (testResults.alkalinity < settings.alkalinity.min) {
      const alkIncrease = (settings.alkalinity.target - testResults.alkalinity) * poolVolume * settings.alkalinity.bakingSodaRatio;
      recs.push({
        chemical: 'Sodium Bicarbonate (Baking Soda)',
        amount: `${Math.round(alkIncrease * 16)} oz`,
        reason: `Total alkalinity is too low (${testResults.alkalinity} ppm). Target: ${settings.alkalinity.min}-${settings.alkalinity.max} ppm`,
        priority: 'medium'
      });
    } else if (testResults.alkalinity > settings.alkalinity.max) {
      const alkDecrease = (testResults.alkalinity - settings.alkalinity.target) * poolVolume * settings.alkalinity.muriaticAcidRatio;
      recs.push({
        chemical: 'Muriatic Acid',
        amount: `${Math.round(alkDecrease * 16)} oz`,
        reason: `Total alkalinity is too high (${testResults.alkalinity} ppm). Target: ${settings.alkalinity.min}-${settings.alkalinity.max} ppm`,
        priority: 'medium'
      });
    }

    // Cyanuric Acid adjustments
    if (testResults.cyanuricAcid < settings.cyanuricAcid.min) {
      const cyaNeeded = (settings.cyanuricAcid.target - testResults.cyanuricAcid) * poolVolume * settings.cyanuricAcid.stabilizerRatio;
      recs.push({
        chemical: 'Cyanuric Acid (Stabilizer)',
        amount: `${Math.round(cyaNeeded * 16)} oz`,
        reason: `Cyanuric acid is too low (${testResults.cyanuricAcid} ppm). Target: ${settings.cyanuricAcid.min}-${settings.cyanuricAcid.max} ppm`,
        priority: 'low'
      });
    } else if (testResults.cyanuricAcid > 100) {
      recs.push({
        chemical: 'Partial water replacement recommended',
        amount: 'Drain and refill 25-50% of pool',
        reason: `Cyanuric acid is too high (${testResults.cyanuricAcid} ppm). Target: ${settings.cyanuricAcid.min}-${settings.cyanuricAcid.max} ppm`,
        priority: 'high'
      });
    }

    // Calcium Hardness adjustments
    if (testResults.calciumHardness < settings.calciumHardness.min) {
      const chIncrease = (settings.calciumHardness.target - testResults.calciumHardness) * poolVolume * settings.calciumHardness.calciumChlorideRatio;
      recs.push({
        chemical: 'Calcium Chloride',
        amount: `${Math.round(chIncrease * 16)} oz`,
        reason: `Calcium hardness is too low (${testResults.calciumHardness} ppm). Target: ${settings.calciumHardness.min}-${settings.calciumHardness.max} ppm`,
        priority: 'low'
      });
    } else if (testResults.calciumHardness > 400) {
      recs.push({
        chemical: 'Partial water replacement recommended',
        amount: 'Drain and refill 25-50% of pool',
        reason: `Calcium hardness is too high (${testResults.calciumHardness} ppm). Target: ${settings.calciumHardness.min}-${settings.calciumHardness.max} ppm`,
        priority: 'medium'
      });
    }

    // Salt adjustments
    if (testResults.salt > 0) {
      if (testResults.salt < settings.salt.min) {
        const deficit = settings.salt.target - testResults.salt;
        const lbs = Math.ceil(deficit * poolVolume * settings.salt.saltRatio);
        const bags = Math.ceil(lbs / 40);
        recs.push({
          chemical: 'Pool-Grade Salt',
          amount: `${lbs} lbs (${bags} × 40 lb bag${bags > 1 ? 's' : ''})`,
          reason: `Salt is too low (${testResults.salt} ppm). Target: ${settings.salt.min}-${settings.salt.max} ppm`,
          priority: 'medium'
        });
      } else if (testResults.salt > settings.salt.max) {
        recs.push({
          chemical: 'Partial water replacement recommended',
          amount: 'Drain and refill to dilute salt level',
          reason: `Salt is too high (${testResults.salt} ppm). Target: ${settings.salt.min}-${settings.salt.max} ppm`,
          priority: 'medium'
        });
      }
    }

    // If everything is balanced
    if (recs.length === 0) {
      recs.push({
        chemical: 'No chemicals needed',
        amount: 'Pool chemistry is balanced',
        reason: 'All levels are within target ranges',
        priority: 'low'
      });
    }

    return recs;
  };

  const handleCalculate = () => {
    if (!poolInfo.size || !poolInfo.type) {
      toast({
        title: "Missing Information",
        description: "Please enter pool size and type",
        variant: "destructive"
      });
      return;
    }

    const recs = calculateRecommendations();
    setRecommendations(recs);
    setShowResults(true);
  };

  const handleSaveCalculation = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('chemical_calculations')
        .insert({
          pool_size: poolInfo.size,
          pool_type: poolInfo.type,
          client_id: poolInfo.clientId || null,
          technician_id: user?.id,
          test_results: testResults as any,
          chemical_recommendations: recommendations as any
        });

      if (error) throw error;

      toast({
        title: "Calculation Saved",
        description: "Chemical calculation has been saved successfully"
      });
    } catch (error) {
      console.error('Error saving calculation:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save the calculation",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setPoolInfo({
        ...poolInfo,
        clientId,
        size: client.pool_size,
        type: client.pool_type
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <Calculator className="h-4 w-4" />;
      case 'low': return <CheckCircle className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <Droplets className="h-8 w-8 text-blue-600" />
            <span>Chemical Calculator</span>
          </h1>
          <p className="text-muted-foreground">Calculate precise chemical adjustments for pool water balance</p>
        </div>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Calculator Settings
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Chemical Calculator Settings</DialogTitle>
              <DialogDescription>
                Adjust target ranges and dosing ratios for chemical calculations
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              {/* pH Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">pH Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="ph-min">Min</Label>
                      <Input
                        id="ph-min"
                        type="number"
                        step="0.1"
                        value={settings.ph.min}
                        onChange={(e) => setSettings({
                          ...settings,
                          ph: { ...settings.ph, min: parseFloat(e.target.value) || 7.2 }
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="ph-max">Max</Label>
                      <Input
                        id="ph-max"
                        type="number"
                        step="0.1"
                        value={settings.ph.max}
                        onChange={(e) => setSettings({
                          ...settings,
                          ph: { ...settings.ph, max: parseFloat(e.target.value) || 7.6 }
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="ph-target">Target</Label>
                      <Input
                        id="ph-target"
                        type="number"
                        step="0.1"
                        value={settings.ph.target}
                        onChange={(e) => setSettings({
                          ...settings,
                          ph: { ...settings.ph, target: parseFloat(e.target.value) || 7.4 }
                        })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="ph-soda">Soda Ash Ratio</Label>
                      <Input
                        id="ph-soda"
                        type="number"
                        step="0.00001"
                        value={settings.ph.sodaAshRatio}
                        onChange={(e) => setSettings({
                          ...settings,
                          ph: { ...settings.ph, sodaAshRatio: parseFloat(e.target.value) || 0.0002 }
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="ph-acid">Muriatic Acid Ratio</Label>
                      <Input
                        id="ph-acid"
                        type="number"
                        step="0.00001"
                        value={settings.ph.muriaticAcidRatio}
                        onChange={(e) => setSettings({
                          ...settings,
                          ph: { ...settings.ph, muriaticAcidRatio: parseFloat(e.target.value) || 0.0003 }
                        })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Chlorine Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Chlorine Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="cl-min">Min (ppm)</Label>
                      <Input
                        id="cl-min"
                        type="number"
                        step="0.1"
                        value={settings.chlorine.min}
                        onChange={(e) => setSettings({
                          ...settings,
                          chlorine: { ...settings.chlorine, min: parseFloat(e.target.value) || 1.0 }
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cl-max">Max (ppm)</Label>
                      <Input
                        id="cl-max"
                        type="number"
                        step="0.1"
                        value={settings.chlorine.max}
                        onChange={(e) => setSettings({
                          ...settings,
                          chlorine: { ...settings.chlorine, max: parseFloat(e.target.value) || 3.0 }
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cl-target">Target (ppm)</Label>
                      <Input
                        id="cl-target"
                        type="number"
                        step="0.1"
                        value={settings.chlorine.target}
                        onChange={(e) => setSettings({
                          ...settings,
                          chlorine: { ...settings.chlorine, target: parseFloat(e.target.value) || 2.0 }
                        })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="cl-ratio">Cal-Hypo Ratio</Label>
                    <Input
                      id="cl-ratio"
                      type="number"
                      step="0.00001"
                      value={settings.chlorine.calHypoRatio}
                      onChange={(e) => setSettings({
                        ...settings,
                        chlorine: { ...settings.chlorine, calHypoRatio: parseFloat(e.target.value) || 0.00013 }
                      })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Alkalinity Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Alkalinity Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="alk-min">Min (ppm)</Label>
                      <Input
                        id="alk-min"
                        type="number"
                        value={settings.alkalinity.min}
                        onChange={(e) => setSettings({
                          ...settings,
                          alkalinity: { ...settings.alkalinity, min: parseInt(e.target.value) || 80 }
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="alk-max">Max (ppm)</Label>
                      <Input
                        id="alk-max"
                        type="number"
                        value={settings.alkalinity.max}
                        onChange={(e) => setSettings({
                          ...settings,
                          alkalinity: { ...settings.alkalinity, max: parseInt(e.target.value) || 120 }
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="alk-target">Target (ppm)</Label>
                      <Input
                        id="alk-target"
                        type="number"
                        value={settings.alkalinity.target}
                        onChange={(e) => setSettings({
                          ...settings,
                          alkalinity: { ...settings.alkalinity, target: parseInt(e.target.value) || 100 }
                        })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="alk-baking">Baking Soda Ratio</Label>
                      <Input
                        id="alk-baking"
                        type="number"
                        step="0.00001"
                        value={settings.alkalinity.bakingSodaRatio}
                        onChange={(e) => setSettings({
                          ...settings,
                          alkalinity: { ...settings.alkalinity, bakingSodaRatio: parseFloat(e.target.value) || 0.00015 }
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="alk-acid">Muriatic Acid Ratio</Label>
                      <Input
                        id="alk-acid"
                        type="number"
                        step="0.00001"
                        value={settings.alkalinity.muriaticAcidRatio}
                        onChange={(e) => setSettings({
                          ...settings,
                          alkalinity: { ...settings.alkalinity, muriaticAcidRatio: parseFloat(e.target.value) || 0.0002 }
                        })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cyanuric Acid Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cyanuric Acid Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="cya-min">Min (ppm)</Label>
                      <Input
                        id="cya-min"
                        type="number"
                        value={settings.cyanuricAcid.min}
                        onChange={(e) => setSettings({
                          ...settings,
                          cyanuricAcid: { ...settings.cyanuricAcid, min: parseInt(e.target.value) || 30 }
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cya-max">Max (ppm)</Label>
                      <Input
                        id="cya-max"
                        type="number"
                        value={settings.cyanuricAcid.max}
                        onChange={(e) => setSettings({
                          ...settings,
                          cyanuricAcid: { ...settings.cyanuricAcid, max: parseInt(e.target.value) || 50 }
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cya-target">Target (ppm)</Label>
                      <Input
                        id="cya-target"
                        type="number"
                        value={settings.cyanuricAcid.target}
                        onChange={(e) => setSettings({
                          ...settings,
                          cyanuricAcid: { ...settings.cyanuricAcid, target: parseInt(e.target.value) || 40 }
                        })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="cya-ratio">Stabilizer Ratio</Label>
                    <Input
                      id="cya-ratio"
                      type="number"
                      step="0.00001"
                      value={settings.cyanuricAcid.stabilizerRatio}
                      onChange={(e) => setSettings({
                        ...settings,
                        cyanuricAcid: { ...settings.cyanuricAcid, stabilizerRatio: parseFloat(e.target.value) || 0.00013 }
                      })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Salt Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Salt / Salinity Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="salt-min">Min (ppm)</Label>
                      <Input
                        id="salt-min"
                        type="number"
                        step="100"
                        value={settings.salt.min}
                        onChange={(e) => setSettings({
                          ...settings,
                          salt: { ...settings.salt, min: parseInt(e.target.value) || 2700 }
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="salt-max">Max (ppm)</Label>
                      <Input
                        id="salt-max"
                        type="number"
                        step="100"
                        value={settings.salt.max}
                        onChange={(e) => setSettings({
                          ...settings,
                          salt: { ...settings.salt, max: parseInt(e.target.value) || 3400 }
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="salt-target">Target (ppm)</Label>
                      <Input
                        id="salt-target"
                        type="number"
                        step="100"
                        value={settings.salt.target}
                        onChange={(e) => setSettings({
                          ...settings,
                          salt: { ...settings.salt, target: parseInt(e.target.value) || 3200 }
                        })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="salt-ratio">Salt Ratio</Label>
                    <Input
                      id="salt-ratio"
                      type="number"
                      step="0.000001"
                      value={settings.salt.saltRatio}
                      onChange={(e) => setSettings({
                        ...settings,
                        salt: { ...settings.salt, saltRatio: parseFloat(e.target.value) || 0.000083 }
                      })}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setSettingsOpen(false)}>
                Save Settings
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-6">
          {/* Pool Information */}
          <Card>
            <CardHeader>
              <CardTitle>Pool Information</CardTitle>
              <CardDescription>Enter pool details or select an existing client</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client">Select Client (Optional)</Label>
                <Select onValueChange={handleClientSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client..." />
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="poolSize">Pool Size (gallons)</Label>
                  <Input
                    id="poolSize"
                    type="number"
                    value={poolInfo.size || ''}
                    onChange={(e) => setPoolInfo({ ...poolInfo, size: parseInt(e.target.value) || 0 })}
                    placeholder="20000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="poolType">Pool Type</Label>
                  <Select value={poolInfo.type} onValueChange={(value) => setPoolInfo({ ...poolInfo, type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Chlorine">Chlorine</SelectItem>
                      <SelectItem value="Saltwater">Saltwater</SelectItem>
                      <SelectItem value="Mineral">Mineral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Test Results */}
          <Card>
            <CardHeader>
              <CardTitle>Water Test Results</CardTitle>
              <CardDescription>Enter current water chemistry levels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ph">pH Level</Label>
                  <Input
                    id="ph"
                    type="number"
                    step="0.1"
                    value={testResults.ph || ''}
                    onChange={(e) => setTestResults({ ...testResults, ph: parseFloat(e.target.value) || 0 })}
                    placeholder="7.4"
                  />
                    <p className="text-xs text-muted-foreground">Target: {settings.ph.min}-{settings.ph.max}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chlorine">Free Chlorine (ppm)</Label>
                    <Input
                      id="chlorine"
                      type="number"
                      step="0.1"
                      value={testResults.chlorine || ''}
                      onChange={(e) => setTestResults({ ...testResults, chlorine: parseFloat(e.target.value) || 0 })}
                      placeholder="2.0"
                    />
                    <p className="text-xs text-muted-foreground">Target: {settings.chlorine.min}-{settings.chlorine.max} ppm</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="alkalinity">Total Alkalinity (ppm)</Label>
                  <Input
                    id="alkalinity"
                    type="number"
                    value={testResults.alkalinity || ''}
                    onChange={(e) => setTestResults({ ...testResults, alkalinity: parseInt(e.target.value) || 0 })}
                    placeholder="100"
                  />
                      <p className="text-xs text-muted-foreground">Target: {settings.alkalinity.min}-{settings.alkalinity.max} ppm</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cyanuricAcid">Cyanuric Acid (ppm)</Label>
                      <Input
                        id="cyanuricAcid"
                        type="number"
                        value={testResults.cyanuricAcid || ''}
                        onChange={(e) => setTestResults({ ...testResults, cyanuricAcid: parseInt(e.target.value) || 0 })}
                        placeholder="40"
                      />
                      <p className="text-xs text-muted-foreground">Target: {settings.cyanuricAcid.min}-{settings.cyanuricAcid.max} ppm</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="calciumHardness">Calcium Hardness (ppm)</Label>
                <Input
                  id="calciumHardness"
                  type="number"
                  value={testResults.calciumHardness || ''}
                  onChange={(e) => setTestResults({ ...testResults, calciumHardness: parseInt(e.target.value) || 0 })}
                  placeholder="200"
                />
                <p className="text-xs text-muted-foreground">Target: {settings.calciumHardness.min}-{settings.calciumHardness.max} ppm</p>
              </div>

              {(poolInfo.type === 'Saltwater' || poolInfo.type?.toLowerCase().includes('salt')) && (
                <div className="space-y-2">
                  <Label htmlFor="salt">Salt / Salinity (ppm)</Label>
                  <Input
                    id="salt"
                    type="number"
                    step="100"
                    value={testResults.salt || ''}
                    onChange={(e) => setTestResults({ ...testResults, salt: parseInt(e.target.value) || 0 })}
                    placeholder="3200"
                  />
                  <p className="text-xs text-muted-foreground">Target: {settings.salt.min}-{settings.salt.max} ppm</p>
                </div>
              )}

              <Button onClick={handleCalculate} className="w-full">
                <Calculator className="mr-2 h-4 w-4" />
                Calculate Recommendations
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results Section */}
        <div>
          {showResults && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Chemical Recommendations</span>
                  <Button onClick={handleSaveCalculation} disabled={loading} variant="outline">
                    <Save className="mr-2 h-4 w-4" />
                    Save Calculation
                  </Button>
                </CardTitle>
                <CardDescription>
                  Based on your pool size of {poolInfo.size?.toLocaleString()} gallons
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recommendations.map((rec, index) => (
                    <div 
                      key={index} 
                      className={`p-4 rounded-lg border ${getPriorityColor(rec.priority)}`}
                    >
                      <div className="flex items-start space-x-3">
                        {getPriorityIcon(rec.priority)}
                        <div className="flex-1">
                          <h4 className="font-semibold">{rec.chemical}</h4>
                          <p className="font-medium text-sm">{rec.amount}</p>
                          <p className="text-sm mt-1">{rec.reason}</p>
                        </div>
                        <span className="text-xs uppercase font-medium">
                          {rec.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}