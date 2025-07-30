import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Droplets, Calculator, AlertTriangle, CheckCircle, Save } from 'lucide-react';

interface TestResults {
  ph: number;
  chlorine: number;
  alkalinity: number;
  cyanuricAcid: number;
  calciumHardness: number;
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

export default function ChemicalCalculator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [poolInfo, setPoolInfo] = useState<PoolInfo>({ size: 0, type: '' });
  const [testResults, setTestResults] = useState<TestResults>({
    ph: 0,
    chlorine: 0,
    alkalinity: 0,
    cyanuricAcid: 0,
    calciumHardness: 0
  });
  const [recommendations, setRecommendations] = useState<ChemicalRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

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
    if (testResults.ph < 7.2) {
      const phIncrease = (7.4 - testResults.ph) * poolVolume * 0.0002;
      recs.push({
        chemical: 'Sodium Carbonate (Soda Ash)',
        amount: `${Math.round(phIncrease * 16)} oz`,
        reason: `pH is too low (${testResults.ph}). Target: 7.2-7.6`,
        priority: 'high'
      });
    } else if (testResults.ph > 7.6) {
      const phDecrease = (testResults.ph - 7.4) * poolVolume * 0.0003;
      recs.push({
        chemical: 'Muriatic Acid',
        amount: `${Math.round(phDecrease * 16)} oz`,
        reason: `pH is too high (${testResults.ph}). Target: 7.2-7.6`,
        priority: 'high'
      });
    }

    // Chlorine adjustments
    if (testResults.chlorine < 1.0) {
      const chlorineNeeded = (2.0 - testResults.chlorine) * poolVolume * 0.00013;
      recs.push({
        chemical: 'Calcium Hypochlorite (Cal-Hypo)',
        amount: `${Math.round(chlorineNeeded * 16)} oz`,
        reason: `Free chlorine is too low (${testResults.chlorine} ppm). Target: 1.0-3.0 ppm`,
        priority: 'high'
      });
    } else if (testResults.chlorine > 5.0) {
      recs.push({
        chemical: 'None - Allow natural dissipation',
        amount: 'Wait 24-48 hours',
        reason: `Free chlorine is too high (${testResults.chlorine} ppm). Target: 1.0-3.0 ppm`,
        priority: 'medium'
      });
    }

    // Alkalinity adjustments
    if (testResults.alkalinity < 80) {
      const alkIncrease = (100 - testResults.alkalinity) * poolVolume * 0.00015;
      recs.push({
        chemical: 'Sodium Bicarbonate (Baking Soda)',
        amount: `${Math.round(alkIncrease * 16)} oz`,
        reason: `Total alkalinity is too low (${testResults.alkalinity} ppm). Target: 80-120 ppm`,
        priority: 'medium'
      });
    } else if (testResults.alkalinity > 120) {
      const alkDecrease = (testResults.alkalinity - 100) * poolVolume * 0.0002;
      recs.push({
        chemical: 'Muriatic Acid',
        amount: `${Math.round(alkDecrease * 16)} oz`,
        reason: `Total alkalinity is too high (${testResults.alkalinity} ppm). Target: 80-120 ppm`,
        priority: 'medium'
      });
    }

    // Cyanuric Acid adjustments
    if (testResults.cyanuricAcid < 30) {
      const cyaNeeded = (40 - testResults.cyanuricAcid) * poolVolume * 0.00013;
      recs.push({
        chemical: 'Cyanuric Acid (Stabilizer)',
        amount: `${Math.round(cyaNeeded * 16)} oz`,
        reason: `Cyanuric acid is too low (${testResults.cyanuricAcid} ppm). Target: 30-50 ppm`,
        priority: 'low'
      });
    } else if (testResults.cyanuricAcid > 100) {
      recs.push({
        chemical: 'Partial water replacement recommended',
        amount: 'Drain and refill 25-50% of pool',
        reason: `Cyanuric acid is too high (${testResults.cyanuricAcid} ppm). Target: 30-50 ppm`,
        priority: 'high'
      });
    }

    // Calcium Hardness adjustments
    if (testResults.calciumHardness < 150) {
      const chIncrease = (200 - testResults.calciumHardness) * poolVolume * 0.00012;
      recs.push({
        chemical: 'Calcium Chloride',
        amount: `${Math.round(chIncrease * 16)} oz`,
        reason: `Calcium hardness is too low (${testResults.calciumHardness} ppm). Target: 150-300 ppm`,
        priority: 'low'
      });
    } else if (testResults.calciumHardness > 400) {
      recs.push({
        chemical: 'Partial water replacement recommended',
        amount: 'Drain and refill 25-50% of pool',
        reason: `Calcium hardness is too high (${testResults.calciumHardness} ppm). Target: 150-300 ppm`,
        priority: 'medium'
      });
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
                  <p className="text-xs text-muted-foreground">Target: 7.2-7.6</p>
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
                  <p className="text-xs text-muted-foreground">Target: 1.0-3.0 ppm</p>
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
                  <p className="text-xs text-muted-foreground">Target: 80-120 ppm</p>
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
                  <p className="text-xs text-muted-foreground">Target: 30-50 ppm</p>
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
                <p className="text-xs text-muted-foreground">Target: 150-300 ppm</p>
              </div>

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