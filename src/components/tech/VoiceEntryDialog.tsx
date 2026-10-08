import { parseReadingValue } from '@/lib/pool-chemistry';
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2, Mic, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { ChemicalOption, ChemicalUnit } from '@/lib/chemicals-added';

export type VoiceReadingField = 'chlorine' | 'ph' | 'alkalinity' | 'cya' | 'calcium' | 'salt';

export interface VoiceApplyPayload {
  readings: { field: VoiceReadingField; value: number }[];
  chemicals: { chemicalId: string; otherName?: string; amount: string; unit: ChemicalUnit }[];
  checklist: string[];
  services: string[];
  actions: string[];
  equipment: { id: string; status: 'ok' | 'issue'; note: string | null }[];
  equipmentNotes: string | null;
  notes: string | null;
  repairNotes: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  catalog: ChemicalOption[];
  checklist: { id: string; label: string }[];
  equipment: { id: string; label: string }[];
  services: string[];
  onApply: (p: VoiceApplyPayload) => void;
}

const READING_LABEL: Record<VoiceReadingField, string> = {
  chlorine: 'Free Chlorine', ph: 'pH', alkalinity: 'Alkalinity', cya: 'CYA', calcium: 'Calcium Hardness', salt: 'Salt',
};
// Plausible physical bounds; outside these we always ask for confirmation.
const PLAUSIBLE: Record<VoiceReadingField, [number, number]> = {
  chlorine: [0, 20], ph: [6.0, 9.0], alkalinity: [0, 400], cya: [0, 300], calcium: [0, 1500], salt: [300, 8000],
};
const MAX_SECONDS = 180;
const TARGET_RATE = 16000;

type Step = 'idle' | 'recording' | 'processing' | 'review';

interface Row<T> { id: string; include: boolean; flag: string | null; heard?: string; data: T }

function encodeWav16k(chunks: Float32Array[], inRate: number): Blob {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const merged = new Float32Array(total);
  let o = 0;
  for (const c of chunks) { merged.set(c, o); o += c.length; }
  const ratio = inRate / TARGET_RATE;
  const len = Math.floor(total / ratio);
  const buf = new ArrayBuffer(44 + len * 2);
  const v = new DataView(buf);
  const tag = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  tag(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true); tag(8, 'WAVE'); tag(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, TARGET_RATE, true); v.setUint32(28, TARGET_RATE * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); tag(36, 'data'); v.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) {
    // simple averaging downsample
    const start = Math.floor(i * ratio), end = Math.min(total, Math.floor((i + 1) * ratio));
    let sum = 0; for (let j = start; j < end; j++) sum += merged[j];
    const s = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    v.setInt16(44 + i * 2, s * (s < 0 ? 32768 : 32767), true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/** Why voice can't run here (shown to the tech instead of hiding the control). */
export function voiceSupport(): { ok: boolean; reason: string } {
  if (typeof window === 'undefined') return { ok: false, reason: 'Voice entry is not available here.' };
  if (!window.isSecureContext) return { ok: false, reason: 'Voice entry needs a secure (https) page. Open getaquaclear.com and try again.' };
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: 'This browser cannot use the microphone. On iPhone, update iOS and use Safari or the installed Aqua Clear app. You can still type the values.' };
  }
  if (!((window as any).AudioContext || (window as any).webkitAudioContext)) {
    return { ok: false, reason: 'This browser cannot record audio. Please type the values instead.' };
  }
  return { ok: true, reason: '' };
}

export function VoiceEntryDialog({ open, onOpenChange, catalog, checklist, equipment, services, onApply }: Props) {
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [readings, setReadings] = useState<Row<{ field: VoiceReadingField; value: string }>[]>([]);
  const [chems, setChems] = useState<Row<{ chemicalId: string; otherName?: string; amount: string; unit: ChemicalUnit | '' }>[]>([]);
  const [tasks, setTasks] = useState<Row<{ kind: 'checklist' | 'service' | 'action'; value: string; label: string }>[]>([]);
  const [equip, setEquip] = useState<Row<{ id: string; status: 'ok' | 'issue'; note: string | null }>[]>([]);
  const [texts, setTexts] = useState<{ equipmentNotes: string; notes: string; repairNotes: string }>({ equipmentNotes: '', notes: '', repairNotes: '' });

  const rec = useRef<{ stream: MediaStream; ctx: AudioContext; node: ScriptProcessorNode; src: MediaStreamAudioSourceNode; chunks: Float32Array[] } | null>(null);
  const timer = useRef<number | null>(null);
  const starting = useRef(false);
  const stopping = useRef(false);

  const cleanup = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    const r = rec.current;
    if (r) {
      r.stream.getTracks().forEach(t => t.stop());
      r.node.disconnect(); r.src.disconnect(); r.node.onaudioprocess = null;
      r.ctx.close().catch(() => undefined);
    }
    rec.current = null;
  };

  useEffect(() => { if (!open) { cleanup(); setStep('idle'); setError(null); } }, [open]);
  useEffect(() => () => cleanup(), []);

  async function start() {
    if (step !== 'idle' || starting.current) return;
    setError(null);
    const support = voiceSupport();
    if (!support.ok) { setError(support.reason); return; }
    starting.current = true;
    // iOS Safari/PWA: the AudioContext must be created and resumed synchronously inside
    // the tap, BEFORE awaiting the mic prompt, or it stays suspended and records silence.
    const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    const resumed = ctx.resume().catch(() => undefined);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      await resumed;
      const src = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      node.onaudioprocess = e => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      src.connect(node); node.connect(ctx.destination);
      rec.current = { stream, ctx, node, src, chunks };
      // If iOS interrupts the mic (call, Siri, app backgrounded), stop cleanly instead of hanging.
      stream.getAudioTracks().forEach(t => { t.onended = () => { if (rec.current) void stop(); }; });
      setSeconds(0);
      setStep('recording');
      timer.current = window.setInterval(() => {
        setSeconds(s => {
          if (s + 1 >= MAX_SECONDS) { void stop(); }
          return s + 1;
        });
      }, 1000);
    } catch (err: any) {
      stream?.getTracks().forEach(t => t.stop());
      ctx.close().catch(() => undefined);
      const name = err?.name ?? '';
      setError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Microphone access is blocked. On iPhone: Settings → Safari (or the Aqua Clear app) → Microphone → Allow, then reopen this screen. You can keep typing values meanwhile.'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
          ? 'No microphone was found on this device. Please type the values instead.'
          : name === 'NotReadableError' || name === 'AbortError'
          ? 'The microphone is in use by another app (call, Siri, recorder). Close it and tap the mic again.'
          : 'Could not start the microphone. Tap the mic to try again, or type the values.'
      );
    } finally {
      starting.current = false;
    }
  }

  async function stop() {
    const r = rec.current;
    if (!r || stopping.current) return;
    stopping.current = true;
    const rate = r.ctx.sampleRate;
    const chunks = r.chunks;
    cleanup();
    stopping.current = false;
    const blob = encodeWav16k(chunks, rate);
    if (blob.size < 8000) { setError('Nothing was recorded. Speak for a few seconds after tapping the mic, then tap stop.'); setStep('idle'); return; }
    setStep('processing');
    try {
      const fd = new FormData();
      fd.append('file', new File([blob], 'recording.wav', { type: 'audio/wav' }));
      fd.append('context', JSON.stringify({
        chemicals: catalog.map(c => ({ id: c.id, label: c.label, units: c.units })),
        checklist: checklist.map(c => c.id),
        equipment: equipment.map(e => e.id),
        services,
      }));
      const { data, error: fnErr } = await supabase.functions.invoke('voice-service-entry', { body: fd });
      if (fnErr || !data?.result) {
        let msg = data?.error as string | undefined;
        try { msg = msg || (await (fnErr as any)?.context?.json?.())?.error; } catch { /* ignore */ }
        setError(msg || 'Voice entry failed. Please try again or type the values.');
        setStep('idle');
        return;
      }
      loadResult(data.transcript ?? '', data.result);
      setStep('review');
    } catch {
      setError('Voice entry failed. Please try again or type the values.');
      setStep('idle');
    }
  }

  function loadResult(t: string, r: any) {
    setTranscript(t);
    let n = 0; const id = () => `v${n++}`;
    setReadings((r.readings ?? []).map((x: any) => {
      const field = x.field as VoiceReadingField;
      let flag: string | null = x.flag ?? null;
      if (x.value == null) flag = flag ?? 'No value heard';
      else {
        const [lo, hi] = PLAUSIBLE[field];
        if (x.value < lo || x.value > hi) flag = flag ?? `${x.value} looks unusual for ${READING_LABEL[field]} — please confirm.`;
      }
      return { id: id(), include: !flag, flag, heard: x.heard, data: { field, value: x.value == null ? '' : String(x.value) } };
    }));
    setChems((r.chemicals ?? []).map((x: any) => {
      const opt = catalog.find(c => c.id === x.chemical_id);
      const unitOk = x.unit && (!opt || opt.units.includes(x.unit));
      let flag: string | null = x.flag ?? null;
      if (x.amount == null) flag = flag ?? 'No amount heard';
      if (!unitOk) flag = flag ?? 'Pick a unit';
      return {
        id: id(), include: !flag, flag, heard: x.heard,
        data: { chemicalId: x.chemical_id, otherName: x.other_name ?? undefined, amount: x.amount == null ? '' : String(x.amount), unit: unitOk ? x.unit : '' },
      };
    }));
    const tk: Row<{ kind: 'checklist' | 'service' | 'action'; value: string; label: string }>[] = [];
    (r.checklist ?? []).forEach((c: string) => tk.push({ id: id(), include: true, flag: null, data: { kind: 'checklist', value: c, label: checklist.find(x => x.id === c)?.label ?? c } }));
    (r.services ?? []).forEach((s: string) => tk.push({ id: id(), include: true, flag: null, data: { kind: 'service', value: s, label: s } }));
    const actionLabel: Record<string, string> = { cleaned_robot: 'Cleaned robot', robot_plugged_in: 'Robot plugged in', robot_in_water: 'Put robot in water', salt_cell_cleaned: 'Cleaned salt cell' };
    (r.actions ?? []).forEach((a: string) => tk.push({ id: id(), include: true, flag: null, data: { kind: 'action', value: a, label: actionLabel[a] ?? a } }));
    setTasks(tk);
    setEquip((r.equipment ?? []).map((e: any) => ({ id: id(), include: true, flag: null, data: { id: e.id, status: e.status, note: e.note ?? null } })));
    const followUp = r.follow_up ? `Follow-up: ${r.follow_up}` : '';
    setTexts({
      equipmentNotes: r.equipment_notes ?? '',
      notes: [r.notes, followUp].filter(Boolean).join(' — '),
      repairNotes: r.repair_notes ?? '',
    });
  }

  function apply() {
    const payload: VoiceApplyPayload = {
      readings: readings.filter(r => r.include && parseReadingValue(r.data.value) != null)
        .map(r => ({ field: r.data.field, value: parseReadingValue(r.data.value) as number })),
      chemicals: chems.filter(c => c.include && c.data.amount.trim() && c.data.unit)
        .map(c => ({ chemicalId: c.data.chemicalId, otherName: c.data.otherName, amount: c.data.amount.trim(), unit: c.data.unit as ChemicalUnit })),
      checklist: tasks.filter(t => t.include && t.data.kind === 'checklist').map(t => t.data.value),
      services: tasks.filter(t => t.include && t.data.kind === 'service').map(t => t.data.value),
      actions: tasks.filter(t => t.include && t.data.kind === 'action').map(t => t.data.value),
      equipment: equip.filter(e => e.include).map(e => e.data),
      equipmentNotes: texts.equipmentNotes.trim() || null,
      notes: texts.notes.trim() || null,
      repairNotes: texts.repairNotes.trim() || null,
    };
    onApply(payload);
    onOpenChange(false);
  }

  const flaggedIncluded = readings.some(r => r.include && r.flag) || chems.some(c => c.include && c.flag);
  const empty = !readings.length && !chems.length && !tasks.length && !equip.length && !texts.notes && !texts.equipmentNotes && !texts.repairNotes;
  const chemLabel = (id: string, other?: string) => id === 'other' ? (other || 'Other') : (catalog.find(c => c.id === id)?.label ?? id);
  const unitsFor = (id: string): ChemicalUnit[] => catalog.find(c => c.id === id)?.units ?? ['lbs', 'oz', 'gal', 'qt'];

  return (
    <Dialog open={open} onOpenChange={o => { if (step !== 'processing') onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Voice entry</DialogTitle>
          <DialogDescription>
            Speak your readings, chemicals and tasks. You'll review everything before it's added — nothing is saved until you tap Complete.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
        )}

        {(step === 'idle' || step === 'recording') && (
          <div className="flex flex-col items-center gap-4 py-4">
            <Button type="button" size="lg" onClick={step === 'idle' ? start : stop}
              variant={step === 'recording' ? 'destructive' : 'default'}
              className={`h-24 w-24 rounded-full ${step === 'recording' ? 'animate-pulse ring-4 ring-destructive/40' : ''}`} aria-label={step === 'idle' ? 'Start recording' : 'Stop recording'}>
              {step === 'idle' ? <Mic className="!h-10 !w-10" /> : <Square className="!h-9 !w-9" />}
            </Button>
            <p className="text-sm font-medium">
              {step === 'idle' ? (error ? 'Tap the mic to try again' : 'Tap to start talking') : `Listening… ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} — tap to finish`}
            </p>
            <p className="text-center text-xs text-muted-foreground">
              e.g. "Chlorine 2.5, pH seven six, alk 90, salt thirty-two fifty. Added two pounds shock and half a gallon muriatic acid. Skimmed, brushed, emptied baskets. Filter at 18 PSI."
            </p>
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Listening back and filling in the form…</p>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3 text-sm italic text-muted-foreground">"{transcript}"</div>
            {empty && <p className="text-sm">Nothing recognizable was heard. Try again or type the values.</p>}

            {readings.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Readings</h4>
                {readings.map((r, i) => (
                  <div key={r.id} className={`rounded-md border p-2 ${r.flag ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30' : ''}`}>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={r.include} onCheckedChange={v => setReadings(p => p.map((x, j) => j === i ? { ...x, include: !!v } : x))} />
                      <span className="flex-1 text-sm font-medium">{READING_LABEL[r.data.field]}</span>
                      <Input className="h-9 w-28" inputMode="decimal" value={r.data.value}
                        onChange={e => setReadings(p => p.map((x, j) => j === i ? { ...x, data: { ...x.data, value: e.target.value } } : x))} />
                      <span className="w-8 text-xs text-muted-foreground">{r.data.field === 'ph' ? '' : 'ppm'}</span>
                    </div>
                    {r.flag && <p className="mt-1 flex items-center gap-1 text-xs text-orange-700 dark:text-orange-300"><AlertTriangle className="h-3 w-3" />{r.flag} Check and tick to include.</p>}
                  </div>
                ))}
              </section>
            )}

            {chems.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chemicals added</h4>
                {chems.map((c, i) => (
                  <div key={c.id} className={`rounded-md border p-2 ${c.flag ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30' : ''}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Checkbox checked={c.include} onCheckedChange={v => setChems(p => p.map((x, j) => j === i ? { ...x, include: !!v } : x))} />
                      <span className="flex-1 text-sm font-medium">{chemLabel(c.data.chemicalId, c.data.otherName)}</span>
                      <Input className="h-9 w-20" inputMode="decimal" value={c.data.amount}
                        onChange={e => setChems(p => p.map((x, j) => j === i ? { ...x, data: { ...x.data, amount: e.target.value } } : x))} />
                      <select className="h-9 rounded-md border bg-background px-2 text-sm" value={c.data.unit}
                        onChange={e => setChems(p => p.map((x, j) => j === i ? { ...x, data: { ...x.data, unit: e.target.value as ChemicalUnit } } : x))}>
                        <option value="">unit</option>
                        {unitsFor(c.data.chemicalId).map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    {c.heard && <p className="mt-1 text-xs text-muted-foreground">Heard: "{c.heard}"</p>}
                    {c.flag && <p className="mt-1 flex items-center gap-1 text-xs text-orange-700 dark:text-orange-300"><AlertTriangle className="h-3 w-3" />{c.flag}</p>}
                  </div>
                ))}
              </section>
            )}

            {(tasks.length > 0 || equip.length > 0) && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tasks & equipment</h4>
                {tasks.map((t, i) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={t.include} onCheckedChange={v => setTasks(p => p.map((x, j) => j === i ? { ...x, include: !!v } : x))} />
                    {t.data.label}
                  </label>
                ))}
                {equip.map((e, i) => (
                  <label key={e.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={e.include} onCheckedChange={v => setEquip(p => p.map((x, j) => j === i ? { ...x, include: !!v } : x))} />
                    {equipment.find(x => x.id === e.data.id)?.label ?? e.data.id}
                    <Badge variant={e.data.status === 'issue' ? 'destructive' : 'outline'}>{e.data.status === 'issue' ? 'Issue' : 'OK'}</Badge>
                    {e.data.note && <span className="text-xs text-muted-foreground">{e.data.note}</span>}
                  </label>
                ))}
              </section>
            )}

            {(['equipmentNotes', 'notes', 'repairNotes'] as const).filter(k => texts[k]).map(k => (
              <div key={k} className="space-y-1">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {k === 'equipmentNotes' ? 'Equipment notes' : k === 'notes' ? 'Visit notes' : 'Repair needed'}
                </h4>
                <Input value={texts[k]} onChange={e => setTexts(p => ({ ...p, [k]: e.target.value }))} />
              </div>
            ))}

            {flaggedIncluded && <p className="text-xs text-orange-700 dark:text-orange-300">Some ticked items were flagged — make sure they're right.</p>}
          </div>
        )}

        {step === 'review' && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setStep('idle'); setError(null); }}>Record again</Button>
            <Button onClick={apply} disabled={empty}>Add to visit form</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
