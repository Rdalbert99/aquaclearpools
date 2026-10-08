import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FlaskConical, Pencil, ArrowDown, ArrowUp, Check, HelpCircle } from 'lucide-react';
import {
  buildIdealChart, type ChartRow, type ChemKey, type ChemistryOverrides, type LatestReadings, type PoolProfile, type RowStatus,
} from '@/lib/ideal-chemistry';

const STATUS_STYLE: Record<RowStatus, { cls: string; Icon: typeof Check }> = {
  low: { cls: 'border-amber-500/60 text-amber-800 dark:text-amber-300', Icon: ArrowDown },
  high: { cls: 'border-destructive/60 text-destructive', Icon: ArrowUp },
  in_range: { cls: 'border-primary/50 text-primary', Icon: Check },
  unknown: { cls: 'border-muted-foreground/40 text-muted-foreground', Icon: HelpCircle },
};

function StatusBadge({ row }: { row: ChartRow }) {
  const { cls, Icon } = STATUS_STYLE[row.status];
  return (
    <Badge variant="outline" className={`gap-1 whitespace-nowrap ${cls}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />{row.statusLabel}
    </Badge>
  );
}

const SURFACE_LABEL = { plaster: 'Plaster / gunite', vinyl: 'Vinyl', fiberglass: 'Fiberglass', unknown: 'Unknown surface' };
const SAN_LABEL = { salt: 'Salt water generator', chlorine: 'Manually chlorinated', unknown: 'Sanitizer unknown' };

const EDITABLE: { key: ChemKey; label: string }[] = [
  { key: 'fc', label: 'Free Chlorine' }, { key: 'ph', label: 'pH' }, { key: 'ta', label: 'Total Alkalinity' },
  { key: 'ch', label: 'Calcium Hardness' }, { key: 'cya', label: 'CYA' }, { key: 'salt', label: 'Salt' },
  { key: 'phosphates', label: 'Phosphates (ppb PO4)' }, { key: 'iron', label: 'Iron (ppm)' }, { key: 'copper', label: 'Copper (ppm)' }, { key: 'metals', label: 'Total metals (ppm)' }, { key: 'borates', label: 'Borates' },
];

interface Props {
  profile: PoolProfile;
  latest?: LatestReadings;
  latestDate?: string | null;
  title?: string;
  /** When provided, shows "Edit targets" and saves overrides (never touches readings). */
  onSaveOverrides?: (o: ChemistryOverrides | null) => Promise<void>;
  currentReadings?: boolean;
}

export function IdealChemistryChart({ profile, latest = {}, latestDate, title = 'Ideal Pool Chemistry', onSaveOverrides, currentReadings }: Props) {
  const rows = useMemo(() => buildIdealChart(profile, latest), [profile, latest]);
  const [editOpen, setEditOpen] = useState(false);
  const hasLatest = rows.some(r => r.latest != null);
  const missing = [profile.sanitizer === 'unknown' && 'sanitizer type', profile.surface === 'unknown' && 'pool surface'].filter(Boolean);

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5" aria-hidden="true" />{title}</CardTitle>
            <CardDescription>
              {SAN_LABEL[profile.sanitizer]} · {SURFACE_LABEL[profile.surface]}
              {profile.fromCustomer ? '' : ' (chosen manually)'}
            </CardDescription>
          </div>
          {onSaveOverrides && (
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-1 h-3.5 w-3.5" />Edit targets</Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Operational targets for a residential outdoor pool — not legal minimums. Pool volume changes dose amounts, not these ppm targets.
          {currentReadings ? ' Current calculator entries; untested values show Unknown.' : hasLatest ? ` Latest values from ${latestDate ? new Date(latestDate).toLocaleDateString() : 'the last visit'}.` : ' No readings on file yet — status shows Unknown.'}
        </p>
        {missing.length > 0 && (
          <p className="rounded-md border border-amber-500/50 p-2 text-xs" role="note">
            Missing on the customer record: {missing.join(' and ')}. Affected targets are shown as conservative general guidance, not guessed.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <caption className="sr-only">{title} targets and latest readings</caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-2">Chemical</th>
                <th scope="col" className="py-2 pr-2">Ideal target</th>
                <th scope="col" className="py-2 pr-2">Acceptable range</th>
                <th scope="col" className="py-2 pr-2">{currentReadings ? 'Current' : 'Latest'}</th>
                <th scope="col" className="py-2 pr-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key} className="border-b align-top last:border-0">
                  <th scope="row" className="py-2 pr-2 text-left font-medium">
                    {r.name}{r.isCustom && <Badge variant="secondary" className="ml-2 text-[10px]">Custom</Badge>}
                    <p className="text-xs font-normal text-muted-foreground">{r.basis}</p>
                    {r.notes.map((n, i) => <p key={i} className="text-xs font-normal text-muted-foreground">• {n}</p>)}
                  </th>
                  <td className="py-2 pr-2">{r.targetLabel}</td>
                  <td className="py-2 pr-2">{r.rangeLabel}</td>
                  <td className="py-2 pr-2">{r.latest != null ? `${r.latest}${r.unit ? ' ' + r.unit : ''}` : '—'}</td>
                  <td className="py-2 pr-2"><StatusBadge row={r} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile cards */}
        <ul className="space-y-2 md:hidden" aria-label={`${title} targets`}>
          {rows.map(r => (
            <li key={r.key} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{r.name}{r.isCustom && <Badge variant="secondary" className="ml-2 text-[10px]">Custom</Badge>}</p>
                <StatusBadge row={r} />
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-muted-foreground">Target</dt><dd className="font-semibold">{r.targetLabel}</dd></div>
                <div><dt className="text-muted-foreground">Range</dt><dd className="font-semibold">{r.rangeLabel}</dd></div>
                <div><dt className="text-muted-foreground">Latest</dt><dd className="font-semibold">{r.latest != null ? `${r.latest}${r.unit ? ' ' + r.unit : ''}` : '—'}</dd></div>
              </dl>
              <p className="mt-1 text-xs text-muted-foreground">{r.basis}</p>
              {r.notes.map((n, i) => <p key={i} className="text-xs text-muted-foreground">• {n}</p>)}
            </li>
          ))}
        </ul>
      </CardContent>
      {onSaveOverrides && (
        <OverridesDialog open={editOpen} onOpenChange={setEditOpen} initial={profile.overrides ?? {}} salt={profile.sanitizer === 'salt'} onSave={onSaveOverrides} />
      )}
    </Card>
  );
}

function OverridesDialog({ open, onOpenChange, initial, salt, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; initial: ChemistryOverrides; salt: boolean;
  onSave: (o: ChemistryOverrides | null) => Promise<void>;
}) {
  const toText = () => {
    const m: Record<string, string> = {};
    for (const { key } of EDITABLE) for (const f of ['min', 'target', 'max'] as const) {
      const v = initial[key]?.[f]; m[`${key}.${f}`] = v != null ? String(v) : '';
    }
    m.salt_source = initial.salt_source ?? '';
    return m;
  };
  const [vals, setVals] = useState<Record<string, string>>(toText);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const out: ChemistryOverrides = {};
    for (const { key, label } of EDITABLE) {
      const o: Record<string, number> = {};
      for (const f of ['min', 'target', 'max'] as const) {
        const t = vals[`${key}.${f}`]?.trim();
        if (!t) continue;
        const n = Number(t);
        if (!Number.isFinite(n) || n < 0) { setError(`${label}: ${f} must be a positive number.`); return; }
        o[f] = n;
      }
      if (o.min != null && o.max != null && o.min > o.max) { setError(`${label}: minimum is above maximum.`); return; }
      if (Object.keys(o).length) (out as Record<string, unknown>)[key] = o;
    }
    if (vals.salt_source?.trim()) out.salt_source = vals.salt_source.trim();
    setSaving(true); setError(null);
    try { await onSave(Object.keys(out).length ? out : null); onOpenChange(false); }
    catch (e) { setError((e as Error).message || 'Could not save.'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (v) setVals(toText()); onOpenChange(v); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Custom targets for this pool</DialogTitle>
          <DialogDescription>Leave blank to use the standard values. Readings are never changed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {EDITABLE.filter(e => e.key !== 'salt' || salt).map(({ key, label }) => (
            <fieldset key={key} className="grid grid-cols-3 gap-2">
              <legend className="col-span-3 text-sm font-medium">{label}</legend>
              {(['min', 'target', 'max'] as const).map(f => (
                <div key={f}>
                  <Label htmlFor={`ov-${key}-${f}`} className="text-xs capitalize">{f}</Label>
                  <Input id={`ov-${key}-${f}`} type="number" inputMode="decimal" className="h-8" value={vals[`${key}.${f}`] ?? ''}
                    onChange={e => setVals(v => ({ ...v, [`${key}.${f}`]: e.target.value }))} />
                </div>
              ))}
            </fieldset>
          ))}
          {salt && (
            <div>
              <Label htmlFor="ov-salt-src" className="text-xs">Salt target source (e.g. cell brand/model)</Label>
              <Input id="ov-salt-src" value={vals.salt_source ?? ''} onChange={e => setVals(v => ({ ...v, salt_source: e.target.value }))} />
            </div>
          )}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save targets'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
