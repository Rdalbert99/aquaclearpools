import { useState, useEffect, useMemo, useRef } from 'react';
import { CyaCalciumDosing } from '@/components/tech/CyaCalciumDosing';
import { ChemistryLab } from '@/components/chemistry/ChemistryLab';
import { buildLabRows, labAdvice, LAB_KEYS } from '@/lib/chemistry-lab';
import { TraceTreatmentHelper } from '@/components/chemistry/TraceTreatmentHelper';
import { IdealChemistryChart } from '@/components/chemistry/IdealChemistryChart';
import { latestFromService, profileFromClient, type PoolProfile, type Sanitizer, type ChemKey, type LatestReadings } from '@/lib/ideal-chemistry';
import type { PoolSurface, CalciumProduct } from '@/lib/cya-calcium-dosing';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Droplets, Calculator, AlertTriangle, CheckCircle, Save } from 'lucide-react';

interface TestResults {
  ph: number;
  chlorine: number;
  alkalinity: number;
  cyanuricAcid: number;
  calciumHardness: number;
  salt: number;
  phosphates: number;
  iron: number;
  copper: number;
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
    calciumHardness: 0,
    salt: 0,
    phosphates: 0,
    iron: 0,
    copper: 0,
  });
  const [entered, setEntered] = useState<Set<keyof TestResults>>(new Set());
  const [calciumProduct, setCalciumProduct] = useState<CalciumProduct | null>(null);
  const labFields: Partial<Record<ChemKey, keyof TestResults>> = { fc: 'chlorine', ph: 'ph', ta: 'alkalinity', cya: 'cyanuricAcid', ch: 'calciumHardness', salt: 'salt', phosphates: 'phosphates', iron: 'iron', copper: 'copper' };
  const labReadings: LatestReadings = Object.fromEntries(Object.entries(labFields).map(([key, field]) => [key, entered.has(field) ? testResults[field] : null]));
  const editReading = (field: keyof TestResults, value: number | null) => {
    setTestResults(prev => ({ ...prev, [field]: value ?? 0 }));
    setEntered(prev => { const next = new Set(prev); if (value == null) next.delete(field); else next.add(field); return next; });
    setShowResults(false);
  };
  const [recommendations, setRecommendations] = useState<ChemicalRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const calculationId = useRef(crypto.randomUUID());
  const savingCalculation = useRef(false);
  const [calculationSaved, setCalculationSaved] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [latestSvc, setLatestSvc] = useState<any | null>(null);
  const [manualSanitizer, setManualSanitizer] = useState<Sanitizer>('unknown');
  const [manualSurface, setManualSurface] = useState<PoolSurface>('unknown');

  const profile: PoolProfile = useMemo(() => selectedClient
    ? profileFromClient(selectedClient)
    : { sanitizer: manualSanitizer, surface: manualSurface, fromCustomer: false, overrides: null },
  [selectedClient, manualSanitizer, manualSurface]);
  useEffect(() => { setShowResults(false); }, [poolInfo.size, poolInfo.type, profile]);

  // Load clients for selection
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, customer, pool_size, pool_type, liner_type, chemistry_targets, status')
        .order('customer');
      
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const calculateRecommendations = (): ChemicalRecommendation[] => {
    return buildLabRows(profile, labReadings, LAB_KEYS.filter(k => k !== 'cc' && (k !== 'salt' || profile.sanitizer === 'salt')))
      .filter(row => row.status === 'low' || row.status === 'high')
      .map(row => ({ chemical: row.name, amount: labAdvice(row, profile, poolInfo.size, calciumProduct ?? 'dihydrate', calciumProduct != null)[0],
        reason: `Current ${row.latest} ${row.unit} · Target ${row.targetLabel} · Range ${row.rangeLabel}`,
        priority: 'medium' as const }));
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
    calculationId.current = crypto.randomUUID();
    setCalculationSaved(false);
    setRecommendations(recs);
    setShowResults(true);
  };

  const handleSaveCalculation = async () => {
    if (savingCalculation.current || calculationSaved) return;
    savingCalculation.current = true;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('chemical_calculations')
        .insert({
          id: calculationId.current,
          pool_size: poolInfo.size,
          pool_type: poolInfo.type,
          client_id: poolInfo.clientId || null,
          technician_id: user?.id,
          test_results: Object.fromEntries(Object.keys(testResults).map(field => [field, entered.has(field as keyof TestResults) ? testResults[field as keyof TestResults] : null])) as any,
          chemical_recommendations: recommendations as any
        });

      if (error && error.code !== '23505') throw error;
      setCalculationSaved(true);

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
      savingCalculation.current = false;
      setLoading(false);
    }
  };

  const handleClientSelect = async (clientId: string) => {
    setCalciumProduct(null);
    if (clientId === '__none') {
      setSelectedClient(null); setLatestSvc(null); setEntered(new Set()); setShowResults(false);
      setPoolInfo({ size: 0, type: '' });
      return;
    }
    const client = clients.find(c => c.id === clientId);
    setSelectedClient(client ?? null); setEntered(new Set()); setShowResults(false);
    setLatestSvc(null);
    if (client) {
      supabase.from('services').select('*').eq('client_id', clientId)
        .order('service_date', { ascending: false }).limit(1)
        .then(({ data }) => setLatestSvc(data?.[0] ?? null));
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
    <div className="p-3 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <Droplets className="h-8 w-8 text-primary" />
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
                    <SelectItem value="__none">No customer (generic pool)</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.customer} - {client.pool_size?.toLocaleString()} gal {client.pool_type}
                        {(client as any).status && (client as any).status !== 'Active' ? ` (${(client as any).status})` : ''}
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
                    type="number" inputMode="decimal" step="any"
                    value={poolInfo.size || ''}
                    onChange={(e) => setPoolInfo({ ...poolInfo, size: parseInt(e.target.value) || 0 })}
                    placeholder="20000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="poolType">Pool Type</Label>
                  <Select disabled={!!selectedClient} value={poolInfo.type} onValueChange={(value) => { setPoolInfo({ ...poolInfo, type: value }); if (!selectedClient) setManualSanitizer(value === 'Saltwater' ? 'salt' : value === 'Chlorine' ? 'chlorine' : 'unknown'); }}>
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
              <ChemistryLab profile={profile} readings={labReadings} gallons={poolInfo.size}
                selected={LAB_KEYS.filter(k => k !== 'cc' && (k !== 'salt' || profile.sanitizer === 'salt'))}
                onReadingChange={(key, value) => { const field = labFields[key]; if (field) editReading(field, value); }}
                renderAdvice={row => row.key === 'cya' || row.key === 'ch' ? <CyaCalciumDosing
                  key={`${selectedClient?.id ?? 'generic'}-${row.key}-${poolInfo.size}`} lockTargets
                  selectedProduct={calciumProduct}
                  onGallonsChange={gallons => setPoolInfo(prev => ({ ...prev, size: gallons ?? 0 }))}
                  onProductChange={product => { setCalciumProduct(product); setShowResults(false); }}
                  showCya={row.key === 'cya'} showCalcium={row.key === 'ch'} cya={labReadings.cya} calcium={labReadings.ch}
                  poolGallons={poolInfo.size} poolType={profile.sanitizer === 'salt' ? 'Saltwater' : 'Chlorine'}
                  linerType={profile.surface} chemistryTargets={profile.overrides} /> : row.key === 'phosphates' || row.key === 'iron' || row.key === 'copper'
                  ? <TraceTreatmentHelper key={row.key} row={row} profile={profile} gallons={poolInfo.size} /> : undefined} />
              <details>
              <summary className="cursor-pointer text-sm font-medium">Reading fields</summary>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ph">pH Level</Label>
                  <Input
                    id="ph"
                    type="number" inputMode="decimal" step="any"
                    value={entered.has('ph') ? testResults.ph : ''}
                    onChange={(e) => editReading('ph', e.target.value === '' ? null : Number(e.target.value))}
                    placeholder="7.4"
                  />
                    <p className="text-xs text-muted-foreground">Target: {buildLabRows(profile, labReadings).find(r => r.key === 'ph')?.rangeLabel ?? 'Target unknown'}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chlorine">Free Chlorine (ppm)</Label>
                    <Input
                      id="chlorine"
                      type="number" inputMode="decimal" step="any"
                      value={entered.has('chlorine') ? testResults.chlorine : ''}
                      onChange={(e) => editReading('chlorine', e.target.value === '' ? null : Number(e.target.value))}
                      placeholder="2.0"
                    />
                    <p className="text-xs text-muted-foreground">Target: {buildLabRows(profile, labReadings).find(r => r.key === 'fc')?.rangeLabel ?? 'Target unknown'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="alkalinity">Total Alkalinity (ppm)</Label>
                  <Input
                    id="alkalinity"
                    type="number" inputMode="decimal" step="any"
                    value={entered.has('alkalinity') ? testResults.alkalinity : ''}
                    onChange={(e) => editReading('alkalinity', e.target.value === '' ? null : Number(e.target.value))}
                    placeholder="100"
                  />
                      <p className="text-xs text-muted-foreground">Target: {buildLabRows(profile, labReadings).find(r => r.key === 'ta')?.rangeLabel ?? 'Target unknown'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cyanuricAcid">Cyanuric Acid (ppm)</Label>
                      <Input
                        id="cyanuricAcid"
                        type="number" inputMode="decimal" step="any"
                        value={entered.has('cyanuricAcid') ? testResults.cyanuricAcid : ''}
                        onChange={(e) => editReading('cyanuricAcid', e.target.value === '' ? null : Number(e.target.value))}
                        placeholder="40"
                      />
                      <p className="text-xs text-muted-foreground">Target: {buildLabRows(profile, labReadings).find(r => r.key === 'cya')?.rangeLabel ?? 'Target unknown'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="calciumHardness">Calcium Hardness (ppm)</Label>
                <Input
                  id="calciumHardness"
                  type="number" inputMode="decimal" step="any"
                  value={entered.has('calciumHardness') ? testResults.calciumHardness : ''}
                  onChange={(e) => editReading('calciumHardness', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="200"
                />
                <p className="text-xs text-muted-foreground">Target: {buildLabRows(profile, labReadings).find(r => r.key === 'ch')?.rangeLabel ?? 'Target unknown'}</p>
              </div>

              {(poolInfo.type === 'Saltwater' || poolInfo.type?.toLowerCase().includes('salt')) && (
                <div className="space-y-2">
                  <Label htmlFor="salt">Salt / Salinity (ppm)</Label>
                  <Input
                    id="salt"
                    type="number" inputMode="decimal" step="any"
                    value={entered.has('salt') ? testResults.salt : ''}
                    onChange={(e) => editReading('salt', e.target.value === '' ? null : Number(e.target.value))}
                    placeholder="3200"
                  />
                  <p className="text-xs text-muted-foreground">Target: {buildLabRows(profile, labReadings).find(r => r.key === 'salt')?.rangeLabel ?? 'Target unknown'}</p>
                </div>
              )}

              </details>
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
                  <Button onClick={handleSaveCalculation} disabled={loading || calculationSaved} variant="outline">
                    <Save className="mr-2 h-4 w-4" />
                    {calculationSaved ? 'Calculation saved' : loading ? 'Saving…' : 'Save Calculation'}
                  </Button>
                </CardTitle>
                <CardDescription>
                  Based on your pool size of {poolInfo.size?.toLocaleString()} gallons
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recommendations.length === 0 && <p className="text-sm text-muted-foreground">No adjustment recommended for the readings entered. Untested values remain unknown.</p>}
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

      {!selectedClient && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">No customer selected</CardTitle>
            <CardDescription>Choose the pool type and surface so the chart isn't guessed. Leave as Unknown for general guidance.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manual-san">Pool type</Label>
              <Select value={manualSanitizer} onValueChange={v => { setManualSanitizer(v as Sanitizer); setPoolInfo(prev => ({ ...prev, type: v === 'salt' ? 'Saltwater' : v === 'chlorine' ? 'Chlorine' : '' })); }}>
                <SelectTrigger id="manual-san"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Unknown</SelectItem>
                  <SelectItem value="salt">Salt water generator</SelectItem>
                  <SelectItem value="chlorine">Manually chlorinated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-surface">Surface</Label>
              <Select value={manualSurface} onValueChange={v => setManualSurface(v as PoolSurface)}>
                <SelectTrigger id="manual-surface"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Unknown</SelectItem>
                  <SelectItem value="plaster">Plaster / gunite</SelectItem>
                  <SelectItem value="vinyl">Vinyl</SelectItem>
                  <SelectItem value="fiberglass">Fiberglass</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedClient && <ChemistryLab profile={profile} readings={latestFromService(latestSvc)} gallons={poolInfo.size} latestDate={latestSvc?.service_date} />}
      <IdealChemistryChart
        currentReadings
        title={selectedClient ? `Ideal Pool Chemistry — ${selectedClient.customer}` : 'Ideal Pool Chemistry (generic)'}
        profile={profile}
        latest={labReadings}
        
      />
    </div>
  );
}