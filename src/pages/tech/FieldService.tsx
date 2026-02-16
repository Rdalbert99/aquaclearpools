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
import { 
  Clock, Droplets, TestTube, CheckCircle, ArrowLeft, AlertTriangle,
} from 'lucide-react';
import { isInRange, getDosageInstruction, type ChemicalId } from '@/lib/pool-chemistry';
import { ArrivalNotification } from '@/components/tech/ArrivalNotification';

type Client = {
  id: string;
  customer: string;
  contact_phone?: string | null;
  contact_email?: string | null;
  pool_size?: number | null;
  pool_type?: string | null;
};

type ServiceData = {
  ph_level?: number | null;
  alkalinity_level?: number | null;
  chlorine_level?: number | null;
  cya_level?: number | null;
  salt_level?: number | null;
  brushed?: boolean;
  vacuumed?: boolean;
  cleaned_filters?: boolean;
  robot_plugged_in?: boolean;
  chemicals_added?: string;
  notes?: string;
  duration?: number | null;
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
};

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
    brushed: false,
    vacuumed: false,
    cleaned_filters: false,
    robot_plugged_in: false,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!clientId) return;
        const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
        if (error) throw error;
        if (mounted) setClient(data as Client);
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

    const parts: string[] = [];
    parts.push(`This is Aqua Clear Pools, your pool is clean and clear.`);

    // Actions performed
    const actions: string[] = [];
    if (data.brushed) actions.push('brushed');
    if (data.vacuumed) actions.push('vacuumed');
    if (data.cleaned_filters) actions.push('cleaned filters');
    if (data.robot_plugged_in) actions.push('plugged in your robot');
    if (actions.length) parts.push(`Today we ${actions.join(', ')}.`);

    parts.push(`Your chlorine is reading ${chlorine}, pH is ${ph}, alkalinity is ${alk}.`);

    if (data.chemicals_added?.trim()) parts.push(`Chemicals added: ${data.chemicals_added.trim()}.`);

    parts.push('Thank you!');
    return parts.join(' ');
  }

  async function completeService() {
    if (!client) return;
    setSaving(true);
    try {
      calculateDuration();

      const message = buildServiceMessage(client.customer, serviceData);

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
          brushed: !!serviceData.brushed,
          vacuumed: !!serviceData.vacuumed,
          cleaned_filters: !!serviceData.cleaned_filters,
          robot_plugged_in: !!serviceData.robot_plugged_in,
        },
        chemicals_added: serviceData.chemicals_added || null,
        notes: serviceData.notes || null,
        duration_minutes: serviceData.duration ?? null,
        before_photo_url: serviceData.beforePhotoUrl || null,
        after_photo_url: serviceData.afterPhotoUrl || null,
        message_preview: message,
        status: 'completed'
      };

      const { error } = await supabase.from('services').insert(payload);
      if (error) throw error;

      // Re-fetch client to get any contact info added during this session
      const { data: freshClient } = await supabase.from('clients').select('contact_phone, contact_email').eq('id', client.id).single();
      const phone = freshClient?.contact_phone || client.contact_phone;
      const email = freshClient?.contact_email || client.contact_email;

      // Send completion SMS via Telnyx
      if (phone) {
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
      navigate('/tech');
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
              <Link to="/tech"><ArrowLeft className="h-4 w-4 mr-2" />Back to Tech</Link>
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
        <Button variant="outline" onClick={() => navigate('/tech')}>
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

      {/* Readings */}
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
                </AlertDescription>
              </Alert>
            );
          })()}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Actions</CardTitle>
          <CardDescription>What you did today.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2"><Checkbox checked={!!serviceData.brushed} onCheckedChange={v => handleInputChange('brushed', !!v)} /><Label>Brushed</Label></div>
          <div className="flex items-center gap-2"><Checkbox checked={!!serviceData.vacuumed} onCheckedChange={v => handleInputChange('vacuumed', !!v)} /><Label>Vacuumed</Label></div>
          <div className="flex items-center gap-2"><Checkbox checked={!!serviceData.cleaned_filters} onCheckedChange={v => handleInputChange('cleaned_filters', !!v)} /><Label>Cleaned Filters</Label></div>
          <div className="flex items-center gap-2"><Checkbox checked={!!serviceData.robot_plugged_in} onCheckedChange={v => handleInputChange('robot_plugged_in', !!v)} /><Label>Plugged in Robot</Label></div>
        </CardContent>
      </Card>

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
          <div>
            <Label htmlFor="chemicals">Chemicals Added</Label>
            <Textarea id="chemicals" rows={3}
              value={serviceData.chemicals_added ?? ''}
              onChange={e => handleInputChange('chemicals_added', e.target.value)}
              placeholder="e.g., 2 lbs cal-hypo, 1 lb pH down..."
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
            <Button onClick={completeService} disabled={saving} className="min-w-[160px]">
              {saving ? <LoadingSpinner /> : (<><CheckCircle className="h-4 w-4 mr-2" /> Complete Service</>)}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}