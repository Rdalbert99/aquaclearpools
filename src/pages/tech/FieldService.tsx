import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { ServicePhotoUpload } from '@/components/tech/ServicePhotoUpload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Clock, Droplets, TestTube, CheckCircle, ArrowLeft, AlertTriangle, Send, Zap, Info, HelpCircle,
  Truck, PlayCircle, Wrench, ListChecks, Camera, Receipt, Sparkles,
} from 'lucide-react';
import { isInRange, getDosageInstruction, type ChemicalId } from '@/lib/pool-chemistry';
import { POOL_TESTS, TEST_BY_ID, normalizeDefaultTests, sortTests, type TestId } from '@/lib/pool-tests';
import { TestGuideDialog } from '@/components/pool/TestGuideDialog';
import { ArrivalNotification } from '@/components/tech/ArrivalNotification';
import { ClientNotesPanel } from '@/components/tech/ClientNotesPanel';
import { ChemicalsAddedInput } from '@/components/service/ChemicalsAddedInput';
import { ChemicalEntry, entriesToString } from '@/lib/chemicals-added';
import { getMissingFixes } from '@/lib/pool-status';
import { useChemicalCatalog } from '@/hooks/useChemicalCatalog';
import { useUnitCosts } from '@/hooks/useUnitCosts';
import { computeServiceCost, fmtMoney } from '@/lib/inventory-cost';
import { CHEMICAL_OPTIONS } from '@/lib/chemicals-added';
import { logMessageSend } from '@/lib/message-log';
import { sendClientMessage, summarizeResults, makeTrackingLink, type SendChannel } from '@/lib/client-message';
import { SmsPreview } from '@/components/tech/SmsPreview';
import { analyzeSms } from '@/lib/sms-segments';
import { calculatePoolHealth } from '@/lib/pool-health';
import { getAlgaecideStatus } from '@/lib/algaecide';
import { buildVisitSnapshot, logVisitEvent } from '@/lib/visit-log';
import { ServiceStickyHeader, type VisitStatus } from '@/components/tech/ServiceStickyHeader';
import { FollowUpPrompt, type FollowUpValue } from '@/components/tech/FollowUpPrompt';
import { IssueFollowUpPrompt, type IssueFollowUpValue } from '@/components/tech/IssueFollowUpPrompt';

type Client = {
  id: string;
  customer: string;
  contact_phone?: string | null;
  contact_email?: string | null;
  pool_size?: number | null;
  pool_type?: string | null;
  included_services?: string[] | null;
  default_tests?: string[] | null;
  contact_address?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  address?: string | null;
  service_days?: string[] | null;
  algaecide_interval_days?: number | null;
  algaecide_product?: string | null;
  algaecide_last_dosed?: string | null;
  assigned_technician_id?: string | null;
};

function buildClientAddress(c: Client): string {
  if (c.contact_address && c.contact_address.trim()) return c.contact_address.trim();
  const parts = [c.street_address, c.city, c.state, c.zip_code].filter(Boolean).join(', ');
  if (parts) return parts;
  return (c.address || '').trim();
}

function clientMapsHref(address: string): string {
  const q = encodeURIComponent(address);
  const isApple = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);
  return isApple ? `https://maps.apple.com/?daddr=${q}` : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

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

/** Quick per-visit checklist, separate from the customer's service plan. */
const CHECKLIST_ITEMS: { id: string; label: string }[] = [
  { id: 'brushed', label: 'Brushed walls & steps' },
  { id: 'skimmed', label: 'Skimmed surface' },
  { id: 'baskets', label: 'Emptied baskets' },
  { id: 'vacuumed', label: 'Vacuumed floor' },
  { id: 'waterline', label: 'Cleaned waterline' },
  { id: 'water_level', label: 'Water level OK' },
];

const EQUIPMENT_ITEMS: { id: string; label: string }[] = [
  { id: 'pump', label: 'Pump running normally' },
  { id: 'filter', label: 'Filter / pressure normal' },
  { id: 'heater', label: 'Heater OK' },
  { id: 'automation', label: 'Automation / timer OK' },
  { id: 'salt_cell', label: 'Salt cell reading normal' },
];

/** Which ServiceData field stores each test's reading. */
const TEST_FIELD: Record<TestId, keyof ServiceData> = {
  ph: 'ph_level',
  alkalinity: 'alkalinity_level',
  chlorine: 'chlorine_level',
  cya: 'cya_level',
  calcium: 'calcium_hardness_level',
  salt: 'salt_level',
};

type ServiceData = {
  ph_level?: number | null;
  alkalinity_level?: number | null;
  chlorine_level?: number | null;
  cya_level?: number | null;
  calcium_hardness_level?: number | null;
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

function fmtElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

export default function FieldService() {
  const [sendingPoolNeeds, setSendingPoolNeeds] = useState(false);
  const { clientId } = useParams();
  const [searchParams] = useSearchParams();
  const shouldPrefill = searchParams.get('prefill') === '1';
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { options: chemCatalog } = useChemicalCatalog();
  const { costs: unitCosts } = useUnitCosts();

  const labelFor = (id: string, other?: string) => {
    if (id === 'other') return other?.trim() || 'Other chemical';
    return CHEMICAL_OPTIONS.find(o => o.id === id)?.label
      ?? chemCatalog.find((o: any) => o.id === id)?.label
      ?? id;
  };

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serviceData, setServiceData] = useState<ServiceData>({
    services_performed: [],
    cleaned_robot: false,
    robot_plugged_in: false,
    robot_in_water: false,
    salt_cell_cleaned: false,
    chemical_entries: [],
  });
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [equipment, setEquipment] = useState<Record<string, boolean>>({});
  const [equipmentIssue, setEquipmentIssue] = useState('');
  const [repairNotes, setRepairNotes] = useState('');
  const [repairEstimate, setRepairEstimate] = useState('');
  const [algaecideDosed, setAlgaecideDosed] = useState(false);

  // Visit lifecycle
  const [onMyWayAt, setOnMyWayAt] = useState<Date | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [technicianLocked, setTechnicianLocked] = useState(false);
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef<number | null>(null);
  const [openCards, setOpenCards] = useState<string[]>(['today']);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');
  const [trackToken, setTrackToken] = useState<string | null>(null);
  const [notifySms, setNotifySms] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [saltInstructionsOpen, setSaltInstructionsOpen] = useState(false);
  const [selectedTests, setSelectedTests] = useState<TestId[]>(normalizeDefaultTests(null));
  const [lastSaltCleaning, setLastSaltCleaning] = useState<string | null>(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [savedServiceId, setSavedServiceId] = useState<string | null>(null);
  const [issuePromptItem, setIssuePromptItem] = useState<{ id: string; label: string } | null>(null);
  const [issueSaving, setIssueSaving] = useState(false);

  const isSaltPool = !!client?.pool_type && /salt/i.test(client.pool_type);
  const saltCellDueDays = (() => {
    if (!isSaltPool) return null;
    if (!lastSaltCleaning) return Infinity;
    return Math.floor((Date.now() - new Date(lastSaltCleaning).getTime()) / 86400000);
  })();
  const saltCellDue = isSaltPool && (saltCellDueDays === Infinity || (typeof saltCellDueDays === 'number' && saltCellDueDays >= 180));

  const algaecide = useMemo(() => getAlgaecideStatus(
    {
      intervalDays: client?.algaecide_interval_days ?? null,
      product: client?.algaecide_product ?? null,
      lastDosed: client?.algaecide_last_dosed ?? null,
    },
    client?.pool_size ?? null,
  ), [client]);

  // Live timer
  useEffect(() => {
    if (!startedAt) return;
    tickRef.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, [startedAt]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!clientId) return;
        const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
        if (error) throw error;
        let clientRecord: any = data;
        if (clientRecord?.user_id && (!clientRecord.contact_phone || !clientRecord.contact_email)) {
          const { data: profile } = await supabase
            .from('users').select('phone, email').eq('id', clientRecord.user_id).maybeSingle();
          if (profile) {
            clientRecord = {
              ...clientRecord,
              contact_phone: clientRecord.contact_phone || profile.phone || null,
              contact_email: clientRecord.contact_email || profile.email || null,
            };
          }
        }
        if (mounted) {
          setClient(clientRecord as Client);
          setSelectedTests(normalizeDefaultTests(clientRecord?.default_tests, clientRecord?.pool_type));
        }

        const { data: prior } = await supabase
          .from('services')
          .select('service_date, actions')
          .eq('client_id', clientId)
          .order('service_date', { ascending: false })
          .limit(50);
        if (mounted && prior) {
          const hit = prior.find((s: any) => s?.actions?.salt_cell_cleaned);
          setLastSaltCleaning(hit?.service_date ?? null);

          if (shouldPrefill && prior.length > 0) {
            const last: any = prior[0];
            const a = last?.actions || {};
            setServiceData(prev => ({
              ...prev,
              services_performed: Array.isArray(a.services_performed) ? a.services_performed : (prev.services_performed ?? []),
              cleaned_robot: !!a.cleaned_robot,
              robot_plugged_in: !!a.robot_plugged_in,
              robot_in_water: !!a.robot_in_water,
            }));
            toast({
              title: 'Defaults prefilled',
              description: `Copied services from last visit on ${new Date(last.service_date).toLocaleDateString()}.`,
            });
          }
        }
      } catch (e) {
        console.error(e);
        toast({ title: "Error", description: "Failed to load client info", variant: "destructive" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [clientId, shouldPrefill, toast]);

  function handleInputChange<K extends keyof ServiceData>(field: K, value: ServiceData[K]) {
    setServiceData(prev => ({ ...prev, [field]: value }));
  }

  function toggleTest(id: TestId, on: boolean) {
    setSelectedTests(prev => sortTests(on ? [...prev, id] : prev.filter(t => t !== id)));
    if (!on) {
      const field = TEST_FIELD[id];
      setServiceData(prev => ({ ...prev, [field]: null }));
    }
  }

  function selectedReadings(): Partial<Record<ChemicalId, number | null>> {
    const out: Partial<Record<ChemicalId, number | null>> = {};
    selectedTests.forEach(id => {
      const def = TEST_BY_ID[id];
      if (!def.chemId) return;
      out[def.chemId] = (serviceData[TEST_FIELD[id]] as number | null | undefined) ?? null;
    });
    return out;
  }

  function dosageInstructions(): string[] {
    const poolGallons = client?.pool_size ?? 10000;
    const readings = selectedReadings();
    return (Object.keys(readings) as ChemicalId[])
      .map(chemId => getDosageInstruction(chemId, readings[chemId], poolGallons))
      .filter(Boolean) as string[];
  }

  function readingsPayload() {
    const out: Record<string, number | null> = {};
    POOL_TESTS.forEach(t => {
      out[t.readingKey] = selectedTests.includes(t.id)
        ? ((serviceData[TEST_FIELD[t.id]] as number | null | undefined) ?? null)
        : null;
    });
    return out;
  }

  const equipmentFlags = EQUIPMENT_ITEMS.filter(i => equipment[i.id] === false).length
    + (equipmentIssue.trim() ? 1 : 0);

  const health = useMemo(() => calculatePoolHealth({
    readings: selectedReadings(),
    openEquipmentIssues: equipmentFlags,
    saltCellDays: typeof saltCellDueDays === 'number' && Number.isFinite(saltCellDueDays) ? saltCellDueDays : (saltCellDue ? 999 : null),
  }), [serviceData, selectedTests, equipmentFlags, saltCellDueDays, saltCellDue]);

  const visitStatus: VisitStatus = savedServiceId ? 'complete' : startedAt ? 'in_progress' : onMyWayAt ? 'on_my_way' : 'scheduled';
  const elapsedLabel = startedAt ? fmtElapsed(now - startedAt.getTime()) : null;

  function currentDurationMinutes() {
    if (!startedAt) return serviceData.duration ?? null;
    return Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 60000));
  }

  async function handleStartService() {
    if (!client || startedAt) return;
    const stamp = new Date();
    setStartedAt(stamp);
    setTechnicianLocked(true);
    setOpenCards(prev => Array.from(new Set([...prev, 'chemistry'])));
    await logVisitEvent({
      clientId: client.id,
      technicianId: user?.id ?? null,
      technicianName: (user as any)?.name ?? null,
      eventType: 'started',
      detail: `Service started at ${stamp.toLocaleTimeString()}`,
    });
    await logVisitEvent({
      clientId: client.id,
      technicianId: user?.id ?? null,
      technicianName: (user as any)?.name ?? null,
      eventType: 'assignment_locked',
      detail: 'Technician assignment locked for this visit',
    });
    toast({ title: 'Service started', description: 'Timer running and technician locked to this visit.' });
  }

  function sanitizeSms(text: string, maxLength = 1200) {
    const cleaned = text
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u2022\u00B7]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/[ \t]+/g, ' ')
      .trim();
    return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 3).trimEnd()}...` : cleaned;
  }

  function buildServiceMessage(_clientName: string, _data: ServiceData, trackedLink?: string) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const techName = (user as any)?.name?.trim();
    const intro = `${greeting}, this is Aqua Clear Pools${techName ? ` - your technician ${techName}` : ''}.`;
    const loginLink = trackedLink || 'https://getaquaclear.com/auth/login';
    return sanitizeSms(`${intro} Your pool service is complete. Log in to see your full results: ${loginLink}`, 600);
  }

  function openReview() {
    if (!client) return;
    const tracked = makeTrackingLink('/auth/login');
    setTrackToken(tracked.token);
    setReviewMessage(buildServiceMessage(client.customer, serviceData, tracked.url));
    setNotifySms(!!client.contact_phone);
    setNotifyEmail(!client.contact_phone && !!client.contact_email);
    setReviewOpen(true);
  }

  async function sendPoolNeedsToAdmin() {
    if (!client || !user) return;
    setSendingPoolNeeds(true);
    try {
      const instructions = dosageInstructions();
      if (!instructions.length) {
        toast({ title: 'No Needs', description: 'All readings are in range — nothing to send.' });
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
        test_results: readingsPayload(),
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
      const duration = currentDurationMinutes();
      const completedAt = new Date();
      const message = reviewMessage.trim() || buildServiceMessage(client.customer, serviceData);
      const { lines, total } = computeServiceCost(serviceData.chemical_entries ?? [], labelFor, unitCosts);

      const notesParts = [serviceData.notes?.trim(), equipmentIssue.trim() && `Equipment issue: ${equipmentIssue.trim()}`,
        repairNotes.trim() && `Repair needed: ${repairNotes.trim()}${repairEstimate.trim() ? ` (est. ${repairEstimate.trim()})` : ''}`]
        .filter(Boolean) as string[];

      const snapshot = buildVisitSnapshot({
        clientId: client.id,
        clientName: client.customer,
        poolSize: client.pool_size,
        poolType: client.pool_type,
        technicianId: user?.id ?? null,
        technicianName: (user as any)?.name ?? null,
        readings: readingsPayload(),
        testsPerformed: selectedTests,
        chemicals: lines.map(l => ({
          chemical_id: l.chemical_id, chemical_label: l.chemical_label, unit: l.unit,
          quantity: l.quantity_used, cost: l.line_cost,
        })),
        checklist,
        equipment: { ...equipment, reported_issue: equipmentIssue.trim() || null },
        servicesPerformed: serviceData.services_performed ?? [],
        healthScore: health.score,
        durationMinutes: duration,
        onMyWayAt: onMyWayAt?.toISOString() ?? null,
        startedAt: startedAt?.toISOString() ?? null,
        completedAt: completedAt.toISOString(),
        photos: { before: serviceData.beforePhotoUrl ?? null, after: serviceData.afterPhotoUrl ?? null },
        notes: notesParts.join(' | ') || null,
        algaecide: algaecide.enabled
          ? { due: algaecide.due, dosedOz: algaecideDosed ? algaecide.doseOz : null, product: algaecide.product }
          : null,
      });

      const payload: any = {
        client_id: client.id,
        technician_id: user?.id ?? null,
        readings: readingsPayload(),
        tests_performed: selectedTests,
        actions: {
          services_performed: serviceData.services_performed ?? [],
          cleaned_robot: !!serviceData.cleaned_robot,
          robot_plugged_in: !!serviceData.robot_plugged_in,
          robot_in_water: !!serviceData.robot_in_water,
          salt_cell_cleaned: !!serviceData.salt_cell_cleaned,
          algaecide_dosed: algaecideDosed,
        },
        chemicals_added: entriesToString(serviceData.chemical_entries ?? [], chemCatalog) || serviceData.chemicals_added || null,
        notes: notesParts.join(' | ') || null,
        duration_minutes: duration,
        before_photo_url: serviceData.beforePhotoUrl || null,
        after_photo_url: serviceData.afterPhotoUrl || null,
        message_preview: message,
        status: 'completed',
        chemicals_cost: Number(total.toFixed(2)),
        on_my_way_at: onMyWayAt?.toISOString() ?? null,
        started_at: startedAt?.toISOString() ?? null,
        completed_at: completedAt.toISOString(),
        technician_locked: technicianLocked,
        checklist,
        equipment_check: { ...equipment, reported_issue: equipmentIssue.trim() || null },
        visit_snapshot: snapshot,
        health_score: health.score,
      };

      const { data: inserted, error } = await supabase.from('services').insert(payload).select('id').single();
      if (error) throw error;
      setSavedServiceId(inserted?.id ?? null);

      await logVisitEvent({
        serviceId: inserted?.id ?? null,
        clientId: client.id,
        technicianId: user?.id ?? null,
        technicianName: (user as any)?.name ?? null,
        eventType: notify ? 'completed' : 'completed_no_notify',
        detail: `Health score ${health.score}${duration ? ` · ${duration} min` : ''}`,
      });

      try {
        if (inserted?.id && lines.length > 0) {
          await supabase.from('service_chemical_usage').insert(
            lines.map(l => ({
              service_id: inserted.id,
              chemical_id: l.chemical_id,
              chemical_label: l.chemical_label,
              unit: l.unit,
              quantity_used: l.quantity_used,
              unit_cost_snapshot: l.unit_cost_snapshot,
            }))
          );
        }
      } catch (usageErr) {
        console.error('Chemical usage log failed:', usageErr);
      }

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const clientUpdate: any = { last_service_date: todayStr };
      if (algaecideDosed) clientUpdate.algaecide_last_dosed = todayStr;
      await supabase.from('clients').update(clientUpdate).eq('id', client.id);

      try {
        const chemsText = entriesToString(serviceData.chemical_entries ?? [], chemCatalog) || serviceData.chemicals_added || '';
        const missing = getMissingFixes(selectedReadings(), chemsText, client.pool_size ?? 10000);
        if (missing.length > 0) {
          await supabase.from('pool_needs_messages').insert({
            client_id: client.id,
            client_name: client.customer,
            technician_id: user?.id ?? null,
            technician_name: user?.name || 'Unknown Tech',
            pool_size: client.pool_size,
            pool_type: client.pool_type,
            chemical_needs: missing,
            test_results: readingsPayload(),
          } as any);
        }
      } catch (notifyErr) {
        console.error('Pool needs auto-notify failed:', notifyErr);
      }

      const { data: freshClient } = await supabase.from('clients').select('contact_phone, contact_email').eq('id', client.id).single();
      const phone = freshClient?.contact_phone || client.contact_phone;
      const email = freshClient?.contact_email || client.contact_email;

      const logBase = {
        clientId: client.id,
        clientName: client.customer,
        technicianId: user?.id ?? null,
        technicianName: (user as any)?.name || 'Unknown Tech',
        source: 'review_and_send',
        message,
      };

      const channels: SendChannel[] = [];
      if (notifySms && phone) channels.push('sms');
      if (notifyEmail && email) channels.push('email');

      if (!notify) {
        await logMessageSend({ ...logBase, channel: 'none', status: 'skipped', errorDetail: 'Completed without notifying customer' });
        toast({ title: 'Service completed', description: 'Service saved. Customer was not notified.' });
      } else if (channels.length) {
        const results = await sendClientMessage({
          channels, phone, email, message,
          subject: 'Aqua Clear Pools - Service Update',
          log: logBase, trackToken,
        });
        const summary = summarizeResults(results);
        toast({
          title: summary.allSent ? 'Service completed' : summary.sent.length ? 'Service completed - partial send' : 'Service saved, send failed',
          description: summary.text,
          variant: summary.failed.length ? 'destructive' : 'default',
        });
      } else {
        await logMessageSend({ ...logBase, channel: 'none', status: 'failed', errorDetail: 'No phone or email on file for this client' });
        toast({ title: 'Service completed', description: 'Service saved successfully.' });
      }

      setReviewOpen(false);
      setFollowUpOpen(true);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Could not complete service', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function leaveVisit() {
    navigate((user as any)?.role === 'admin' ? '/admin' : '/tech');
  }

  async function createIssueFollowUp(value: IssueFollowUpValue) {
    if (!client || !issuePromptItem) return;
    setIssueSaving(true);
    try {
      const parts = value.partsNeeded
        ? `Parts needed — ordered by ${value.orderedBy === 'customer' ? 'customer' : 'Aqua Clear'}`
        : 'No parts needed';
      const notes = [value.description, parts].filter(Boolean).join(' — ');

      const { error } = await supabase.from('follow_up_visits').insert({
        client_id: client.id,
        source_service_id: savedServiceId,
        scheduled_date: value.date,
        reason: 'Equipment repair',
        notes: `${issuePromptItem.label}: ${notes}`,
        assigned_technician_id: user?.id ?? null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;

      if (value.description) {
        setEquipmentIssue(prev => {
          const line = `${issuePromptItem.label}: ${value.description} (${parts})`;
          return prev.trim() ? `${prev.trim()}\n${line}` : line;
        });
      }

      await logVisitEvent({
        serviceId: savedServiceId,
        clientId: client.id,
        technicianId: user?.id ?? null,
        technicianName: (user as any)?.name ?? null,
        eventType: 'follow_up_created',
        detail: `${issuePromptItem.label} issue — ${parts} — follow-up ${value.date}`,
      });

      toast({
        title: 'Follow-up scheduled',
        description: `${issuePromptItem.label} repair on ${new Date(`${value.date}T00:00:00`).toLocaleDateString()}. ${parts}.`,
      });
      setIssuePromptItem(null);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Could not create follow-up', variant: 'destructive' });
    } finally {
      setIssueSaving(false);
    }
  }

  async function createFollowUp(value: FollowUpValue) {
    if (!client) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('follow_up_visits').insert({
        client_id: client.id,
        source_service_id: savedServiceId,
        scheduled_date: value.date,
        reason: value.reason,
        notes: value.notes ?? null,
        assigned_technician_id: user?.id ?? null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;

      if (savedServiceId) {
        const { data: svc } = await supabase.from('services').select('visit_snapshot').eq('id', savedServiceId).maybeSingle();
        const snap: any = (svc as any)?.visit_snapshot;
        if (snap?.outcome) {
          snap.outcome.follow_up = { date: value.date, reason: value.reason, notes: value.notes ?? null };
          await supabase.from('services').update({ visit_snapshot: snap }).eq('id', savedServiceId);
        }
      }

      await logVisitEvent({
        serviceId: savedServiceId,
        clientId: client.id,
        technicianId: user?.id ?? null,
        technicianName: (user as any)?.name ?? null,
        eventType: 'follow_up_created',
        detail: `${value.reason} on ${value.date}`,
      });

      toast({ title: 'Follow-up scheduled', description: `${value.reason} on ${new Date(`${value.date}T00:00:00`).toLocaleDateString()}.` });
      setFollowUpOpen(false);
      leaveVisit();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Could not create follow-up', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 flex items-center justify-center min-h-[300px]"><LoadingSpinner /></div>;
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

  const address = buildClientAddress(client);
  const planServices = (client.included_services && client.included_services.length > 0) ? client.included_services : ALL_SERVICES;
  const performed = serviceData.services_performed ?? [];
  const chemCostTotals = computeServiceCost(serviceData.chemical_entries ?? [], labelFor, unitCosts);
  const chemistryOpen = performed.includes(CHEM_TEST_SERVICE) || selectedTests.length > 0;

  const CardHeaderRow = ({ icon: Icon, title, hint, badge }: { icon: any; title: string; hint?: string; badge?: React.ReactNode }) => (
    <div className="flex flex-1 items-center gap-3 text-left">
      <Icon className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 font-semibold">{title}{badge}</div>
        {hint && <p className="truncate text-xs font-normal text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 pb-24">
      <ServiceStickyHeader
        customerName={client.customer}
        address={address || null}
        mapsHref={address ? clientMapsHref(address) : null}
        status={visitStatus}
        technicianName={(user as any)?.name ?? null}
        technicianLocked={technicianLocked}
        elapsedLabel={elapsedLabel}
        health={health}
        onBack={leaveVisit}
      />

      <Accordion type="multiple" value={openCards} onValueChange={setOpenCards} className="space-y-3">
        {/* 1. TODAY'S SERVICE */}
        <AccordionItem value="today" className="rounded-lg border bg-card px-4">
          <AccordionTrigger className="hover:no-underline">
            <CardHeaderRow icon={Clock} title="Today's Service" hint="Actions, plan items, robot & salt cell" />
          </AccordionTrigger>
          <AccordionContent className="space-y-5 pb-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <ArrivalNotification
                clientName={client.customer}
                clientId={client.id}
                clientPhone={client.contact_phone}
                clientEmail={client.contact_email}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant={onMyWayAt ? 'secondary' : 'outline'}
                className="h-12"
                onClick={async () => {
                  const stamp = new Date();
                  setOnMyWayAt(stamp);
                  await logVisitEvent({
                    clientId: client.id,
                    technicianId: user?.id ?? null,
                    technicianName: (user as any)?.name ?? null,
                    eventType: 'on_my_way',
                    detail: `Marked on my way at ${stamp.toLocaleTimeString()}`,
                  });
                  toast({ title: 'On my way logged', description: 'Use the notification panel above to text the customer.' });
                }}
              >
                <Truck className="mr-2 h-4 w-4" />
                {onMyWayAt ? `On my way · ${onMyWayAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Mark "On My Way"'}
              </Button>
              <Button type="button" className="h-12" disabled={!!startedAt} onClick={handleStartService}>
                <PlayCircle className="mr-2 h-4 w-4" />
                {startedAt ? `Started · ${startedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Start Service'}
              </Button>
            </div>

            <ClientNotesPanel clientId={client.id} />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-sm font-semibold">Services performed</Label>
                <Button
                  type="button" size="sm" variant="outline"
                  onClick={() => {
                    const all = planServices.every(s => performed.includes(s));
                    handleInputChange('services_performed', all ? [] : [...planServices]);
                  }}
                >
                  {planServices.every(s => performed.includes(s)) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {planServices.map(svc => (
                  <div key={svc} className="flex items-center gap-2">
                    <Checkbox
                      id={`svc-${svc}`}
                      checked={performed.includes(svc)}
                      onCheckedChange={v => handleInputChange('services_performed',
                        v ? Array.from(new Set([...performed, svc])) : performed.filter(s => s !== svc))}
                    />
                    <Label htmlFor={`svc-${svc}`} className="cursor-pointer text-sm font-normal">{svc}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-3">
              <Label className="text-sm font-semibold">Robot</Label>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Checkbox id="robot-cleaned" checked={!!serviceData.cleaned_robot} onCheckedChange={v => handleInputChange('cleaned_robot', !!v)} />
                  <Label htmlFor="robot-cleaned" className="cursor-pointer text-sm font-normal">Cleaned Robot</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="robot-plugged" checked={!!serviceData.robot_plugged_in} onCheckedChange={v => handleInputChange('robot_plugged_in', !!v)} />
                  <Label htmlFor="robot-plugged" className="cursor-pointer text-sm font-normal">Plugged in Robot</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="robot-water" checked={!!serviceData.robot_in_water} onCheckedChange={v => handleInputChange('robot_in_water', !!v)} />
                  <Label htmlFor="robot-water" className="cursor-pointer text-sm font-normal">Put Robot in Water</Label>
                </div>
              </div>
            </div>

            {isSaltPool && (
              <div className="border-t pt-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <Label className="flex items-center gap-2 text-sm font-semibold">
                    <Zap className="h-4 w-4 text-blue-500" /> Salt Cell
                  </Label>
                  <Button type="button" size="sm" variant="outline" onClick={() => setSaltInstructionsOpen(true)}>
                    <Info className="mr-1 h-4 w-4" /> Cleaning Instructions
                  </Button>
                </div>
                {saltCellDue && (
                  <Alert className="mb-2 border-orange-300 bg-orange-50 dark:bg-orange-950/30">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-sm">
                      Salt cell cleaning is due (recommended every 6 months).{' '}
                      {lastSaltCleaning ? `Last cleaned ${new Date(lastSaltCleaning).toLocaleDateString()}.` : 'No prior cleaning on record.'}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex items-center gap-2">
                  <Checkbox id="salt-cell-cleaned" checked={!!serviceData.salt_cell_cleaned}
                    onCheckedChange={v => handleInputChange('salt_cell_cleaned', !!v)} />
                  <Label htmlFor="salt-cell-cleaned" className="cursor-pointer text-sm font-normal">Cleaned Salt Cell</Label>
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* 2. CHEMISTRY */}
        <AccordionItem value="chemistry" className="rounded-lg border bg-card px-4">
          <AccordionTrigger className="hover:no-underline">
            <CardHeaderRow
              icon={TestTube}
              title="Chemistry"
              hint="Tests, dosing and algaecide schedule"
              badge={algaecide.due ? <Badge variant="outline" className="border-orange-500/40 bg-orange-500/15 text-orange-700 dark:text-orange-300">Algaecide due</Badge> : undefined}
            />
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            {algaecide.enabled && (
              <Alert className={algaecide.due ? 'border-orange-300 bg-orange-50 dark:bg-orange-950/30' : ''}>
                <Sparkles className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <span className="font-semibold">Maintenance algaecide:</span>{' '}
                  {algaecide.due
                    ? `Due now — add ${algaecide.doseLabel} for this ${(client.pool_size ?? 10000).toLocaleString()} gal pool.`
                    : `Next dose in ${algaecide.daysUntilDue} day(s) (every ${algaecide.intervalDays} days).`}
                  {algaecide.lastDosed && ` Last dosed ${algaecide.lastDosed.toLocaleDateString()}.`}
                  <div className="mt-2 flex items-center gap-2">
                    <Checkbox id="algaecide-dosed" checked={algaecideDosed} onCheckedChange={v => setAlgaecideDosed(!!v)} />
                    <Label htmlFor="algaecide-dosed" className="cursor-pointer text-sm font-normal">
                      Added {algaecide.doseOz} fl oz today
                    </Label>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {!algaecide.enabled && (
              <p className="text-xs text-muted-foreground">
                No algaecide schedule set for this customer. Set an interval on the client's edit page to get automatic dosing reminders.
              </p>
            )}

            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tests performed this visit</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {POOL_TESTS.map(t => (
                  <div key={t.id} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                    <Checkbox id={`test-${t.id}`} checked={selectedTests.includes(t.id)} disabled={!t.optional}
                      onCheckedChange={v => toggleTest(t.id, !!v)} />
                    <Label htmlFor={`test-${t.id}`} className="flex-1 cursor-pointer text-sm font-normal">
                      {t.label}
                      {!t.optional && <span className="ml-1 text-[10px] uppercase text-muted-foreground">required</span>}
                    </Label>
                    <TestGuideDialog testId={t.id} />
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Values turn <span className="font-medium text-green-600">green</span> in range, <span className="font-medium text-red-600">red</span> out.
              Tap <HelpCircle className="inline h-3.5 w-3.5 align-[-2px]" /> for Taylor kit steps.
            </p>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {POOL_TESTS.filter(t => selectedTests.includes(t.id)).map(t => {
                const field = TEST_FIELD[t.id];
                const val = serviceData[field] as number | null | undefined;
                const status = t.chemId ? isInRange(t.chemId, val) : 'none';
                const colorClass = status === 'in' ? 'text-green-600 border-green-500 ring-green-400'
                  : status === 'out' ? 'text-red-600 border-red-500 ring-red-400' : '';
                return (
                  <div key={t.id}>
                    <div className="flex items-center gap-1">
                      <Label htmlFor={`reading-${t.id}`}>{t.short}</Label>
                      <TestGuideDialog testId={t.id} className="h-5 w-5" />
                    </div>
                    <Input
                      id={`reading-${t.id}`} type="number" inputMode="decimal" step={t.step} value={val ?? ''}
                      onChange={e => {
                        const raw = e.target.value;
                        const parsed = raw === '' ? null : (t.integer ? parseInt(raw, 10) : parseFloat(raw));
                        handleInputChange(field, (Number.isNaN(parsed as number) ? null : parsed) as any);
                      }}
                      className={colorClass ? `font-semibold ${colorClass}` : ''}
                    />
                  </div>
                );
              })}
            </div>

            {(() => {
              const instructions = dosageInstructions();
              if (!instructions.length) return null;
              return (
                <Alert variant="destructive" className="border-red-300 bg-red-50 text-red-900">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="mb-1 font-semibold">
                      Chemical adjustments needed ({(client.pool_size ?? 10000).toLocaleString()} gal pool):
                    </p>
                    <ul className="list-disc space-y-1 pl-4 text-sm">
                      {instructions.map((inst, i) => <li key={i}>{inst}</li>)}
                    </ul>
                    <Button size="sm" variant="outline" className="mt-3 border-red-400 text-red-800 hover:bg-red-100"
                      disabled={sendingPoolNeeds} onClick={sendPoolNeedsToAdmin}>
                      <Send className="mr-1.5 h-4 w-4" />
                      {sendingPoolNeeds ? 'Sending...' : 'Send Pool Needs to Admin'}
                    </Button>
                  </AlertDescription>
                </Alert>
              );
            })()}

            <div>
              <Label>Chemicals Added</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Add each chemical you applied. The customer message will explain what each one does.
              </p>
              <ChemicalsAddedInput
                value={serviceData.chemical_entries ?? []}
                onChange={(entries) => handleInputChange('chemical_entries', entries)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 3. EQUIPMENT */}
        <AccordionItem value="equipment" className="rounded-lg border bg-card px-4">
          <AccordionTrigger className="hover:no-underline">
            <CardHeaderRow icon={Wrench} title="Equipment"
              hint="Pump, filter, heater, automation, salt cell"
              badge={equipmentFlags > 0 ? <Badge variant="destructive">{equipmentFlags} flagged</Badge> : undefined} />
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            {EQUIPMENT_ITEMS.map(item => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                <span className="text-sm">{item.label}</span>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant={equipment[item.id] === true ? 'default' : 'outline'}
                    onClick={() => setEquipment(p => ({ ...p, [item.id]: true }))}>OK</Button>
                  <Button type="button" size="sm" variant={equipment[item.id] === false ? 'destructive' : 'outline'}
                    onClick={() => {
                      setEquipment(p => ({ ...p, [item.id]: false }));
                      setIssuePromptItem({ id: item.id, label: item.label });
                    }}>Issue</Button>
                </div>
              </div>
            ))}
            <div>
              <Label htmlFor="equipment-issue">Describe any equipment issue</Label>
              <Textarea id="equipment-issue" rows={2} value={equipmentIssue}
                onChange={e => setEquipmentIssue(e.target.value)} placeholder="What is wrong and what did you observe..." />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 4. CHECKLIST */}
        <AccordionItem value="checklist" className="rounded-lg border bg-card px-4">
          <AccordionTrigger className="hover:no-underline">
            <CardHeaderRow icon={ListChecks} title="Checklist"
              hint={`${Object.values(checklist).filter(Boolean).length} of ${CHECKLIST_ITEMS.length} done`} />
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CHECKLIST_ITEMS.map(item => (
                <div key={item.id} className="flex items-center gap-2">
                  <Checkbox id={`chk-${item.id}`} checked={!!checklist[item.id]}
                    onCheckedChange={v => setChecklist(p => ({ ...p, [item.id]: !!v }))} />
                  <Label htmlFor={`chk-${item.id}`} className="cursor-pointer text-sm font-normal">{item.label}</Label>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 5. PHOTOS & NOTES */}
        <AccordionItem value="photos" className="rounded-lg border bg-card px-4">
          <AccordionTrigger className="hover:no-underline">
            <CardHeaderRow icon={Camera} title="Photos & Notes" hint="Before / after photos and visit notes" />
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            <div className="grid gap-6 md:grid-cols-2">
              <ServicePhotoUpload clientId={client.id} label="Before Photo"
                onUploaded={(url) => handleInputChange('beforePhotoUrl', url)} />
              <ServicePhotoUpload clientId={client.id} label="After Photo"
                onUploaded={(url) => handleInputChange('afterPhotoUrl', url)} />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={3} value={serviceData.notes ?? ''}
                onChange={e => handleInputChange('notes', e.target.value)} placeholder="Any issues or special actions..." />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 6. REPAIRS & ESTIMATES */}
        <AccordionItem value="repairs" className="rounded-lg border bg-card px-4">
          <AccordionTrigger className="hover:no-underline">
            <CardHeaderRow icon={Wrench} title="Repairs & Estimates" hint="Flag work that needs a return visit" />
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <div>
              <Label htmlFor="repair-notes">Repair needed</Label>
              <Textarea id="repair-notes" rows={2} value={repairNotes} onChange={e => setRepairNotes(e.target.value)}
                placeholder="Part, symptom, and what it will take to fix..." />
            </div>
            <div>
              <Label htmlFor="repair-estimate">Rough estimate</Label>
              <Input id="repair-estimate" value={repairEstimate} onChange={e => setRepairEstimate(e.target.value)}
                placeholder="$150 parts + 1 hr labor" />
            </div>
            <p className="text-xs text-muted-foreground">
              Repairs are saved with the visit. Schedule the return visit in the follow-up prompt when you complete service.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* 7. BILLING (placeholder) */}
        <AccordionItem value="billing" className="rounded-lg border bg-card px-4">
          <AccordionTrigger className="hover:no-underline">
            <CardHeaderRow icon={Receipt} title="Billing" hint="Internal cost of this visit — invoicing coming soon" />
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            {chemCostTotals.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No chemicals logged yet — costs appear here as you add them.</p>
            ) : (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="mb-1 font-medium">Cost of this service (internal only)</div>
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {chemCostTotals.lines.map((l, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{l.quantity_used.toFixed(2)} {l.unit} {l.chemical_label} @ {fmtMoney(l.unit_cost_snapshot)}/{l.unit}</span>
                      <span>{fmtMoney(l.line_cost)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
                  <span>Service chemical cost</span><span>{fmtMoney(chemCostTotals.total)}</span>
                </div>
                {chemCostTotals.lines.some(l => l.unit_cost_snapshot === 0) && (
                  <div className="mt-1 text-xs text-amber-600">
                    Some chemicals have no purchase logged yet — log them in Inventory for accurate costs.
                  </div>
                )}
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Customer invoicing will be wired into this card later.</p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Complete bar */}
      <div className="mt-4 space-y-3 rounded-lg border bg-card p-4">
        <SmsPreview
          message={buildServiceMessage(client.customer, serviceData)}
          target={client.contact_phone || client.contact_email || null}
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={openReview} disabled={saving} className="h-12 min-w-[180px] flex-1">
            <CheckCircle className="mr-2 h-4 w-4" /> Complete Service
          </Button>
          <Button variant="secondary" onClick={() => completeService(false)} disabled={saving} className="h-12 flex-1 min-w-[180px]">
            Complete without notifying
          </Button>
        </div>
        {chemistryOpen && <p className="text-xs text-muted-foreground">Health score at completion: {health.score}/100 — {health.label}.</p>}
      </div>

      {/* Salt cell instructions */}
      <Dialog open={saltInstructionsOpen} onOpenChange={setSaltInstructionsOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" /> Salt Cell Cleaning — Step by Step
            </DialogTitle>
            <DialogDescription>
              Perform every 6 months on all salt pools. Always wear gloves and eye protection when handling acid.
            </DialogDescription>
          </DialogHeader>
          <ol className="list-outside list-decimal space-y-2 pl-5 text-sm">
            {SALT_CELL_STEPS.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
          <DialogFooter><Button onClick={() => setSaltInstructionsOpen(false)}>Got it</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review & send */}
      <Dialog open={reviewOpen} onOpenChange={(o) => !saving && setReviewOpen(o)}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Review Customer Message</DialogTitle>
            <DialogDescription>
              Edit the message and choose how to deliver it. Every send is recorded in the message logs.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={notifySms} disabled={!client?.contact_phone} onCheckedChange={(c) => setNotifySms(!!c)} />
              Text {client?.contact_phone ? `(${client.contact_phone})` : '(no phone on file)'}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={notifyEmail} disabled={!client?.contact_email} onCheckedChange={(c) => setNotifyEmail(!!c)} />
              Email {client?.contact_email ? `(${client.contact_email})` : '(no email on file)'}
            </label>
          </div>
          <Textarea rows={6} value={reviewMessage} onChange={(e) => setReviewMessage(e.target.value)}
            className="max-h-[35dvh] font-mono text-sm" />
          <SmsPreview
            message={reviewMessage}
            showBody={false}
            target={client?.contact_phone ? `Text to ${client.contact_phone}` : client?.contact_email ? `Email to ${client.contact_email}` : null}
          />
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button className="w-full sm:order-4 sm:w-auto" onClick={() => completeService(true)}
              disabled={saving || !reviewMessage.trim() || (!notifySms && !notifyEmail) || (notifySms && analyzeSms(reviewMessage).overLimit)}>
              {saving ? <LoadingSpinner /> : (<><Send className="mr-2 h-4 w-4" /> Send &amp; Complete</>)}
            </Button>
            <Button variant="secondary" className="w-full sm:order-3 sm:w-auto" onClick={() => completeService(false)} disabled={saving}>
              Complete without notifying
            </Button>
            <Button variant="ghost" className="w-full sm:order-2 sm:w-auto" disabled={saving}
              onClick={() => client && setReviewMessage(buildServiceMessage(client.customer, serviceData))}>
              Reset
            </Button>
            <Button variant="outline" className="w-full sm:order-1 sm:w-auto" onClick={() => setReviewOpen(false)} disabled={saving}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FollowUpPrompt
        open={followUpOpen}
        saving={saving}
        onSkip={() => { setFollowUpOpen(false); leaveVisit(); }}
        onConfirm={createFollowUp}
      />

      <IssueFollowUpPrompt
        open={!!issuePromptItem}
        saving={issueSaving}
        equipmentLabel={issuePromptItem?.label ?? 'Equipment'}
        initialDescription={equipmentIssue.trim() || undefined}
        onSkip={() => setIssuePromptItem(null)}
        onConfirm={createIssueFollowUp}
      />
    </div>
  );
}
