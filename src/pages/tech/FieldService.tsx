import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
import { ServicePhotoUpload } from '@/components/tech/ServicePhotoUpload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  Clock, Droplets, TestTube, CheckCircle, ArrowLeft, AlertTriangle, Send, Zap, Info,
} from 'lucide-react';
import { isInRange, getDosageInstruction, type ChemicalId } from '@/lib/pool-chemistry';
import { ArrivalNotification } from '@/components/tech/ArrivalNotification';
import { ChemicalsAddedInput } from '@/components/service/ChemicalsAddedInput';
import { ChemicalEntry, entriesToString, entriesToCustomerExplanation } from '@/lib/chemicals-added';
import { getMissingFixes } from '@/lib/pool-status';
import { useChemicalCatalog } from '@/hooks/useChemicalCatalog';

type Client = {
  id: string;
  customer: string;
  contact_phone?: string | null;
  contact_email?: string | null;
  pool_size?: number | null;
  pool_type?: string | null;
  included_services?: string[] | null;
};

const ALL_SERVICES = [
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
  'Pump Maintenance',
];

const CHEM_TEST_SERVICE = 'Chemical Testing & Balancing';

type ServiceData = {
  ph_level?: number | null;
  alkalinity_level?: number | null;
  chlorine_level?: number | null;
  cya_level?: number | null;
  salt_level?: number | null;
  services_performed?: string[];
  cleaned_robot?: boolean;
  robot_plugged_in?: boolean;
  robot_in_water?: boolean;
  salt_cell_cleaned?: boolean;
  chemicals_added?: string;
  chemical_entries?: ChemicalEntry[];
  notes?: string;
  duration?: number | null;
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
};

const SALT_CELL_STEPS = [
  'Turn off power to the pool pump and the salt chlorine generator at the breaker.',
  'Close the valves before and after the salt cell to isolate it from the plumbing.',
  'Unscrew the unions on both ends of the salt cell and carefully remove it.',
  'Inspect the plates — light dusty scale is normal; heavy white/crusty buildup means it needs cleaning.',
  'Rinse the inside of the cell with a garden hose to flush loose debris. If it looks clean, skip acid washing.',
  'If scale remains, mix a cleaning solution: 4 parts water to 1 part muriatic acid (ALWAYS add acid to water, never the reverse). Wear gloves and eye protection.',
  'Cap one end of the cell, pour the solution in, and let it foam for no more than 10–15 minutes. Do not soak longer or you will damage the plates.',
  'Pour the used solution into a safe container for disposal. Rinse the cell thoroughly with a hose.',
  'Reinstall the cell, hand-tighten the unions (do not over-tighten — no tools), and open the isolation valves.',
  'Turn power back on, run the pump, and check for leaks at the unions.',
  'Verify the generator shows normal salt/voltage readings. Log the cleaning in the service notes.',
];

export default function FieldService() {
  const [sendingPoolNeeds, setSendingPoolNeeds] = useState(false);
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { options: chemCatalog } = useChemicalCatalog();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startTime] = useState(new Date());
  const [serviceData, setServiceData] = useState<ServiceData>({
    services_performed: [],
    cleaned_robot: false,
    robot_plugged_in: false,
    robot_in_water: false,
    salt_cell_cleaned: false,
    chemical_entries: [],
  });
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');
  const [saltInstructionsOpen, setSaltInstructionsOpen] = useState(false);
  const [lastSaltCleaning, setLastSaltCleaning] = useState<string | null>(null);

  const isSaltPool = !!client?.pool_type && /salt/i.test(client.pool_type);
  const saltCellDueDays = (() => {
    if (!isSaltPool) return null;
    if (!lastSaltCleaning) return Infinity;
    const days = Math.floor((Date.now() - new Date(lastSaltCleaning).getTime()) / 86400000);
    return days;
  })();
  const saltCellDue = isSaltPool && (saltCellDueDays === Infinity || (typeof saltCellDueDays === 'number' && saltCellDueDays >= 180));

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!clientId) return;
        const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
        if (error) throw error;
        if (mounted) setClient(data as Client);

        // Look up the most recent salt cell cleaning for this client
        const { data: prior } = await supabase
          .from('services')
          .select('service_date, actions')
          .eq('client_id', clientId)
          .order('service_date', { ascending: false })
          .limit(50);
        if (mounted && prior) {
          const hit = prior.find((s: any) => s?.actions?.salt_cell_cleaned);
          setLastSaltCleaning(hit?.service_date ?? null);
        }
      } catch (e) {
        console.error(e);
        toast({ title: "Error", description: "Failed to load client info", variant: "destructive" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [clientId, toast]);

  function handleInputChange<K extends keyof ServiceData>(field: K, value: ServiceData[K]) {
    setServiceData(prev => ({ ...prev, [field]: value }));
  }

  function calculateDuration() {
    const endTime = new Date();
    const minutes = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000));
    setServiceData(prev => ({ ...prev, duration: minutes }));
  }

  function buildServiceMessage(clientName: string, data: ServiceData) {
    const chlorine = data.chlorine_level != null ? data.chlorine_level : 'N/A';
    const ph = data.ph_level != null ? data.ph_level : 'N/A';
    const alk = data.alkalinity_level != null ? data.alkalinity_level : 'N/A';
    const salt = data.salt_level != null ? data.salt_level : null;

    // Determine if balance is off (any reading out of range)
    const checks: Array<{ id: ChemicalId; val: number | null | undefined }> = [
      { id: 'ph', val: data.ph_level },
      { id: 'alkalinity', val: data.alkalinity_level },
      { id: 'chlorine', val: data.chlorine_level },
      { id: 'cya', val: data.cya_level },
      { id: 'salt', val: data.salt_level },
    ];
    const anyOut = checks.some(c => isInRange(c.id, c.val) === 'out');

    const parts: string[] = [];
    parts.push(
      anyOut
        ? `This is Aqua Clear Pools. We serviced your pool today and added chemicals to bring it back into balance.`
        : `This is Aqua Clear Pools, your pool is clean and clear.`
    );

    // Actions performed (services + robot tasks)
    const performed = [...(data.services_performed ?? [])];
    if (data.cleaned_robot) performed.push('Cleaned Robot');
    if (data.robot_plugged_in) performed.push('Plugged in Robot');
    if (data.robot_in_water) performed.push('Put Robot in Water');
    if (data.salt_cell_cleaned) performed.push('Cleaned Salt Cell');
    if (performed.length) {
      const lower = performed.map(s => s.toLowerCase());
      parts.push(`Today we ${lower.join(', ')}.`);
    }

    const testedChem = (data.services_performed ?? []).includes(CHEM_TEST_SERVICE);
    if (testedChem) {
      let readingsStr = `Your chlorine is reading ${chlorine}, pH is ${ph}, alkalinity is ${alk}`;
      if (salt != null) readingsStr += `, salt is ${salt} ppm`;
      readingsStr += '.';
      parts.push(readingsStr);
    }

    const chemExplain = entriesToCustomerExplanation(data.chemical_entries ?? [], chemCatalog);
    if (chemExplain) {
      parts.push(chemExplain);
    } else if (data.chemicals_added?.trim()) {
      parts.push(`Chemicals added: ${data.chemicals_added.trim()}.`);
    }

    parts.push('Thank you!');
    return parts.join(' ');
  }

  function openReview() {
    if (!client) return;
    setReviewMessage(buildServiceMessage(client.customer, serviceData));
    setReviewOpen(true);
  }

  async function sendPoolNeedsToAdmin() {
    if (!client || !user) return;
    setSendingPoolNeeds(true);
    try {
      const poolGallons = client.pool_size ?? 10000;
      const instructions = ([
        { id: 'ph' as ChemicalId, field: 'ph_level' as const },
        { id: 'alkalinity' as ChemicalId, field: 'alkalinity_level' as const },
        { id: 'chlorine' as ChemicalId, field: 'chlorine_level' as const },
        { id: 'cya' as ChemicalId, field: 'cya_level' as const },
        { id: 'salt' as ChemicalId, field: 'salt_level' as const },
      ])
        .map(({ id, field }) => getDosageInstruction(id, serviceData[field], poolGallons))
        .filter(Boolean) as string[];

      if (!instructions.length) {
        toast({ title: 'No Needs', description: 'All readings are in range — nothing to send.', variant: 'default' });
        setSendingPoolNeeds(false);
        return;
      }

      const { error } = await supabase.from('pool_needs_messages').insert({
        client_id: client.id,
        client_name: client.customer,
        technician_id: user.id,
        technician_name: user.name || 'Unknown Tech',
        pool_size: client.pool_size,
        pool_type: client.pool_type,
        chemical_needs: instructions,
        test_results: {
          ph: serviceData.ph_level ?? null,
          ta: serviceData.alkalinity_level ?? null,
          fc: serviceData.chlorine_level ?? null,
          cya: serviceData.cya_level ?? null,
          salt: serviceData.salt_level ?? null,
        },
      } as any);

      if (error) throw error;
      toast({ title: 'Sent!', description: 'Pool needs sent to admin.' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Failed to send pool needs', variant: 'destructive' });
    } finally {
      setSendingPoolNeeds(false);
    }
  }

  async function completeService(notify: boolean = true) {
    if (!client) return;
    setSaving(true);
    try {
      calculateDuration();

      const message = reviewMessage.trim() || buildServiceMessage(client.customer, serviceData);

      const payload = {
        client_id: client.id,
        technician_id: user?.id ?? null,
        readings: {
          ph: serviceData.ph_level ?? null,
          ta: serviceData.alkalinity_level ?? null,
          fc: serviceData.chlorine_level ?? null,
          cya: serviceData.cya_level ?? null,
          salt: serviceData.salt_level ?? null,
        },
        actions: {
          services_performed: serviceData.services_performed ?? [],
          cleaned_robot: !!serviceData.cleaned_robot,
          robot_plugged_in: !!serviceData.robot_plugged_in,
          robot_in_water: !!serviceData.robot_in_water,
          salt_cell_cleaned: !!serviceData.salt_cell_cleaned,
        },
        chemicals_added: entriesToString(serviceData.chemical_entries ?? [], chemCatalog) || serviceData.chemicals_added || null,
        notes: serviceData.notes || null,
        duration_minutes: serviceData.duration ?? null,
        before_photo_url: serviceData.beforePhotoUrl || null,
        after_photo_url: serviceData.afterPhotoUrl || null,
        message_preview: message,
        status: 'completed'
      };

      const { error } = await supabase.from('services').insert(payload);
      if (error) throw error;

      // Mark the client as serviced today so the calendar updates for everyone
      // (admin + all techs). Use local date (YYYY-MM-DD).
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      await supabase
        .from('clients')
        .update({ last_service_date: todayStr })
        .eq('id', client.id);

      // Auto-notify admin if any out-of-range readings weren't addressed by chemicals added
      try {
        const chemsText = entriesToString(serviceData.chemical_entries ?? [], chemCatalog) || serviceData.chemicals_added || '';
        const missing = getMissingFixes(
          {
            ph: serviceData.ph_level ?? null,
            alkalinity: serviceData.alkalinity_level ?? null,
            chlorine: serviceData.chlorine_level ?? null,
            cya: serviceData.cya_level ?? null,
            salt: serviceData.salt_level ?? null,
          },
          chemsText,
          client.pool_size ?? 10000,
        );
        if (missing.length > 0) {
          await supabase.from('pool_needs_messages').insert({
            client_id: client.id,
            client_name: client.customer,
            technician_id: user?.id ?? null,
            technician_name: user?.name || 'Unknown Tech',
            pool_size: client.pool_size,
            pool_type: client.pool_type,
            chemical_needs: missing,
            test_results: {
              ph: serviceData.ph_level ?? null,
              ta: serviceData.alkalinity_level ?? null,
              fc: serviceData.chlorine_level ?? null,
              cya: serviceData.cya_level ?? null,
              salt: serviceData.salt_level ?? null,
            },
          } as any);
        }
      } catch (notifyErr) {
        console.error('Pool needs auto-notify failed:', notifyErr);
      }


      // Re-fetch client to get any contact info added during this session
      const { data: freshClient } = await supabase.from('clients').select('contact_phone, contact_email').eq('id', client.id).single();
      const phone = freshClient?.contact_phone || client.contact_phone;
      const email = freshClient?.contact_email || client.contact_email;

      // Send completion SMS via Telnyx (only when notify=true)
      if (!notify) {
        toast({ title: 'Service completed', description: 'Service saved. Customer was not notified.' });
      } else if (phone) {
        try {
          const { error } = await supabase.functions.invoke('send-sms-via-telnyx', {
            body: { to: phone, message: message }
          });
          
          if (error) {
            console.error('SMS sending error:', error);
            window.location.href = `sms:${phone}?&body=${encodeURIComponent(message)}`;
            toast({ title: 'Service completed', description: 'SMS app opened with message.' });
          } else {
            toast({ title: 'Service completed', description: 'Saved and SMS sent to client.' });
          }
        } catch (smsError) {
          console.error('SMS API error:', smsError);
          window.location.href = `sms:${phone}?&body=${encodeURIComponent(message)}`;
          toast({ title: 'Service completed', description: 'SMS app opened with message.' });
        }
      } else if (email) {
        window.location.href = `mailto:${email}?subject=${encodeURIComponent('Aqua Clear Service Update')}&body=${encodeURIComponent(message)}`;
        toast({ title: 'Service completed', description: 'Email app opened with message.' });
      } else {
        toast({ title: 'Service completed', description: 'Service saved successfully.' });
      }
      setReviewOpen(false);
      navigate((user as any)?.role === 'admin' ? '/admin' : '/tech');
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Could not complete service', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Client not found.</p>
            <Button asChild className="mt-4">
              <Link to={(user as any)?.role === 'admin' ? '/admin' : '/tech'}><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Droplets className="h-5 w-5" /> {client.customer}
        </h1>
        <Button variant="outline" onClick={() => navigate((user as any)?.role === 'admin' ? '/admin' : '/tech')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
      {/* Arrival Notification */}
      <ArrivalNotification
        clientName={client.customer}
        clientId={client.id}
        clientPhone={client.contact_phone}
        clientEmail={client.contact_email}
      />

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Actions</CardTitle>
          <CardDescription>Check off everything you did today. Items reflect this customer's regular service plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {(() => {
            const planServices = (client.included_services && client.included_services.length > 0)
              ? client.included_services
              : ALL_SERVICES;
            const performed = serviceData.services_performed ?? [];
            const toggle = (svc: string, checked: boolean) => {
              const next = checked
                ? Array.from(new Set([...performed, svc]))
                : performed.filter(s => s !== svc);
              handleInputChange('services_performed', next);
            };
            return (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold">Services performed</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const all = planServices.every(s => performed.includes(s));
                      handleInputChange('services_performed', all ? [] : [...planServices]);
                    }}
                  >
                    {planServices.every(s => performed.includes(s)) ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {planServices.map(svc => (
                    <div key={svc} className="flex items-center gap-2">
                      <Checkbox
                        id={`svc-${svc}`}
                        checked={performed.includes(svc)}
                        onCheckedChange={v => toggle(svc, !!v)}
                      />
                      <Label htmlFor={`svc-${svc}`} className="text-sm font-normal cursor-pointer">{svc}</Label>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="pt-2 border-t">
            <Label className="text-sm font-semibold">Robot</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
              <div className="flex items-center gap-2">
                <Checkbox id="robot-cleaned" checked={!!serviceData.cleaned_robot} onCheckedChange={v => handleInputChange('cleaned_robot', !!v)} />
                <Label htmlFor="robot-cleaned" className="text-sm font-normal cursor-pointer">Cleaned Robot</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="robot-plugged" checked={!!serviceData.robot_plugged_in} onCheckedChange={v => handleInputChange('robot_plugged_in', !!v)} />
                <Label htmlFor="robot-plugged" className="text-sm font-normal cursor-pointer">Plugged in Robot</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="robot-water" checked={!!serviceData.robot_in_water} onCheckedChange={v => handleInputChange('robot_in_water', !!v)} />
                <Label htmlFor="robot-water" className="text-sm font-normal cursor-pointer">Put Robot in Water</Label>
              </div>
            </div>
          </div>

          {isSaltPool && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-500" /> Salt Cell
                </Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setSaltInstructionsOpen(true)}>
                  <Info className="h-4 w-4 mr-1" /> Cleaning Instructions
                </Button>
              </div>
              {saltCellDue && (
                <Alert className="mb-2 border-orange-300 bg-orange-50 dark:bg-orange-950/30">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-sm">
                    Salt cell cleaning is due (recommended every 6 months).{' '}
                    {lastSaltCleaning
                      ? `Last cleaned ${new Date(lastSaltCleaning).toLocaleDateString()}.`
                      : 'No prior cleaning on record.'}
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="salt-cell-cleaned"
                  checked={!!serviceData.salt_cell_cleaned}
                  onCheckedChange={v => handleInputChange('salt_cell_cleaned', !!v)}
                />
                <Label htmlFor="salt-cell-cleaned" className="text-sm font-normal cursor-pointer">
                  Cleaned Salt Cell
                </Label>
              </div>
              {!saltCellDue && lastSaltCleaning && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last cleaned {new Date(lastSaltCleaning).toLocaleDateString()}.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Salt cell cleaning instructions */}
      <Dialog open={saltInstructionsOpen} onOpenChange={setSaltInstructionsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" /> Salt Cell Cleaning — Step by Step
            </DialogTitle>
            <DialogDescription>
              Perform every 6 months on all salt pools. Always wear gloves and eye protection when handling acid.
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal list-outside pl-5 space-y-2 text-sm">
            {SALT_CELL_STEPS.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <DialogFooter>
            <Button onClick={() => setSaltInstructionsOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Readings — only when chemical testing was performed */}
      {(serviceData.services_performed ?? []).includes(CHEM_TEST_SERVICE) && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TestTube className="h-5 w-5" /> Readings</CardTitle>
          <CardDescription>Enter quick test results. Values turn <span className="text-green-600 font-medium">green</span> if in range, <span className="text-red-600 font-medium">red</span> if out.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {([
              { id: 'ph' as ChemicalId, label: 'pH', field: 'ph_level' as const, step: '0.1', parse: parseFloat },
              { id: 'alkalinity' as ChemicalId, label: 'TA', field: 'alkalinity_level' as const, step: '1', parse: (v: string) => parseInt(v || '0') },
              { id: 'chlorine' as ChemicalId, label: 'FC', field: 'chlorine_level' as const, step: '0.1', parse: parseFloat },
              { id: 'cya' as ChemicalId, label: 'CYA', field: 'cya_level' as const, step: '1', parse: (v: string) => parseInt(v || '0') },
              { id: 'salt' as ChemicalId, label: 'Salt', field: 'salt_level' as const, step: '100', parse: (v: string) => parseInt(v || '0') },
            ]).map(({ id, label, field, step, parse }) => {
              const val = serviceData[field];
              const status = isInRange(id, val);
              const colorClass = status === 'in' ? 'text-green-600 border-green-500 ring-green-400'
                : status === 'out' ? 'text-red-600 border-red-500 ring-red-400' : '';
              return (
                <div key={id}>
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    step={step}
                    value={val ?? ''}
                    onChange={e => handleInputChange(field, parse(e.target.value))}
                    className={colorClass ? `font-semibold ${colorClass}` : ''}
                  />
                </div>
              );
            })}
          </div>

          {/* Dosage instructions for out-of-range readings */}
          {client && (() => {
            const poolGallons = client.pool_size ?? 10000;
            const instructions = ([
              { id: 'ph' as ChemicalId, field: 'ph_level' as const },
              { id: 'alkalinity' as ChemicalId, field: 'alkalinity_level' as const },
              { id: 'chlorine' as ChemicalId, field: 'chlorine_level' as const },
              { id: 'cya' as ChemicalId, field: 'cya_level' as const },
              { id: 'salt' as ChemicalId, field: 'salt_level' as const },
            ])
              .map(({ id, field }) => getDosageInstruction(id, serviceData[field], poolGallons))
              .filter(Boolean) as string[];

            if (!instructions.length) return null;
            return (
              <Alert variant="destructive" className="border-red-300 bg-red-50 text-red-900">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-semibold mb-1">Chemical adjustments needed (based on {poolGallons.toLocaleString()} gal pool):</p>
                  <ul className="list-disc pl-4 space-y-1 text-sm">
                    {instructions.map((inst, i) => <li key={i}>{inst}</li>)}
                  </ul>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 border-red-400 text-red-800 hover:bg-red-100"
                    disabled={sendingPoolNeeds}
                    onClick={sendPoolNeedsToAdmin}
                  >
                    <Send className="h-4 w-4 mr-1.5" />
                    {sendingPoolNeeds ? 'Sending...' : 'Send Pool Needs to Admin'}
                  </Button>
                </AlertDescription>
              </Alert>
            );
          })()}
        </CardContent>
      </Card>
      )}

      {/* Photos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Droplets className="h-5 w-5" /> Photos</CardTitle>
          <CardDescription>Snap before/after from your phone.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <ServicePhotoUpload
            clientId={client.id}
            label="Before Photo"
            onUploaded={(url) => handleInputChange('beforePhotoUrl', url)}
          />
          <ServicePhotoUpload
            clientId={client.id}
            label="After Photo"
            onUploaded={(url) => handleInputChange('afterPhotoUrl', url)}
          />
        </CardContent>
      </Card>

      {/* Notes / Chemicals */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Notes and chemicals added.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto-generated dosage suggestions */}
          {(() => {
            const poolGallons = client.pool_size ?? 10000;
            const suggestions = ([
              { id: 'ph' as ChemicalId, field: 'ph_level' as const },
              { id: 'alkalinity' as ChemicalId, field: 'alkalinity_level' as const },
              { id: 'chlorine' as ChemicalId, field: 'chlorine_level' as const },
              { id: 'cya' as ChemicalId, field: 'cya_level' as const },
              { id: 'salt' as ChemicalId, field: 'salt_level' as const },
            ])
              .map(({ id, field }) => getDosageInstruction(id, serviceData[field], poolGallons))
              .filter(Boolean) as string[];

            if (!suggestions.length) return null;
            return (
              <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-900 text-sm space-y-1">
                <p className="font-semibold flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Suggested additions ({poolGallons.toLocaleString()} gal):</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {suggestions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            );
          })()}
          <div>
            <Label>Chemicals Added</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Add each chemical you applied. The customer message will explain what each one does.
            </p>
            <ChemicalsAddedInput
              value={serviceData.chemical_entries ?? []}
              onChange={(entries) => handleInputChange('chemical_entries', entries)}
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3}
              value={serviceData.notes ?? ''}
              onChange={e => handleInputChange('notes', e.target.value)}
              placeholder="Any issues or special actions..."
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={calculateDuration}>
              <Clock className="h-4 w-4 mr-2" /> Calc Duration
            </Button>
            <div className="text-sm text-muted-foreground">
              {serviceData.duration ? `Duration: ${serviceData.duration} min` : 'Duration not set'}
            </div>
          </div>
          <div className="pt-2">
            <Button onClick={openReview} disabled={saving} className="min-w-[160px]">
              <CheckCircle className="h-4 w-4 mr-2" /> Review & Send
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={reviewOpen} onOpenChange={(o) => !saving && setReviewOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Customer Message</DialogTitle>
            <DialogDescription>
              Edit the message below before sending it to the customer. This text will be sent via SMS (or email if no phone).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={8}
            value={reviewMessage}
            onChange={(e) => setReviewMessage(e.target.value)}
            className="font-mono text-sm"
          />
          <div className="text-xs text-muted-foreground">{reviewMessage.length} characters</div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              variant="ghost"
              onClick={() => client && setReviewMessage(buildServiceMessage(client.customer, serviceData))}
              disabled={saving}
            >
              Reset
            </Button>
            <Button onClick={completeService} disabled={saving || !reviewMessage.trim()}>
              {saving ? <LoadingSpinner /> : (<><Send className="h-4 w-4 mr-2" /> Send & Complete</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}