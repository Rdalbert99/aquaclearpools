import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useChemicalCatalog } from '@/hooks/useChemicalCatalog';
import {
  calciumDose, calciumProductFromLabel, cyaDose, detectSurface, isSaltPool, validGallons,
  type CalciumProduct, type DoseResult,
} from '@/lib/cya-calcium-dosing';
import { calciumTargetFor, cyaTargetFor, profileFromClient } from '@/lib/ideal-chemistry';

interface Props {
  showCya: boolean;
  showCalcium: boolean;
  cya: number | null | undefined;
  calcium: number | null | undefined;
  poolGallons: number | null | undefined;
  poolType?: string | null;
  linerType?: string | null;
  chemistryTargets?: unknown;
}

function num(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function DoseCard({ title, r, target, onTarget }: { title: string; r: DoseResult; target: string; onTarget: (v: string) => void }) {
  const tone = r.status === 'low' ? 'border-amber-300 bg-amber-50'
    : r.status === 'high' ? 'border-red-300 bg-red-50'
    : r.status === 'needs_volume' ? 'border-amber-300 bg-amber-50' : 'bg-muted/40';
  return (
    <div className={`space-y-2 rounded-lg border p-3 ${tone}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        <Badge variant="outline" className="text-[10px]">Recommendation only</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div><p className="text-muted-foreground">Current</p><p className="font-semibold">{r.current ?? '—'} ppm</p></div>
        <div>
          <Label className="text-xs text-muted-foreground">Target (ppm)</Label>
          <Input className="h-8" type="number" inputMode="numeric" value={target} placeholder={String(r.range.target)}
            onChange={e => onTarget(e.target.value)} />
        </div>
        <div><p className="text-muted-foreground">Raise by</p><p className="font-semibold">{r.delta > 0 ? `${r.delta} ppm` : '—'}</p></div>
      </div>
      <p className="text-xs text-muted-foreground">Typical range {r.range.min}–{r.range.max} ppm</p>
      <p className="text-sm font-medium">{r.message}</p>
      {r.lbs != null && (
        <p className="text-sm">
          <span className="font-semibold">{r.lbs} lb ({r.oz} oz)</span> · {r.product}
        </p>
      )}
      {r.notes.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          {r.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}

export function CyaCalciumDosing({ showCya, showCalcium, cya, calcium, poolGallons, poolType, linerType, chemistryTargets }: Props) {
  const { options } = useChemicalCatalog();
  const [gallonsText, setGallonsText] = useState(validGallons(poolGallons) ? String(poolGallons) : '');
  const [cyaTarget, setCyaTarget] = useState('');
  const [chTarget, setChTarget] = useState('');

  const surface = detectSurface(linerType, poolType);
  const salt = isSaltPool(poolType, linerType);
  const profile = profileFromClient({ pool_type: poolType, liner_type: linerType, chemistry_targets: chemistryTargets });
  const cyaRange = cyaTargetFor(profile).t;
  const chRange = calciumTargetFor(profile).t;
  const inventoryProduct = useMemo(() => {
    const opt = options.find(o => /calcium/i.test(o.label) || o.id === 'calcium_chloride');
    return calciumProductFromLabel(opt?.label);
  }, [options]);
  const [chosen, setChosen] = useState<CalciumProduct | null>(null);
  const product: CalciumProduct = chosen ?? inventoryProduct ?? 'dihydrate';
  const productKnown = chosen != null || inventoryProduct != null;

  if (!showCya && !showCalcium) return null;
  const hasCya = showCya && cya != null;
  const hasCh = showCalcium && calcium != null;
  if (!hasCya && !hasCh) return null;

  const gallons = num(gallonsText);
  const gallonsValid = validGallons(gallons) != null;

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Label htmlFor="dose-gallons" className="text-xs">Pool volume (gal)</Label>
          <Input id="dose-gallons" type="number" inputMode="numeric" value={gallonsText}
            onChange={e => setGallonsText(e.target.value)} placeholder="Required"
            className={gallonsValid ? '' : 'border-amber-500'} />
        </div>
        <p className="text-xs text-muted-foreground">
          {gallonsValid ? 'Doses use this volume for this visit only.' : 'No valid volume on file — enter gallons to see amounts.'}
          {' '}Surface: {surface}{salt ? ' · salt pool' : ''}.
        </p>
      </div>

      {hasCya && (
        <DoseCard title="Stabilizer (CYA)" target={cyaTarget} onTarget={setCyaTarget}
          r={cyaDose({ reading: cya, gallons, target: num(cyaTarget), salt, range: cyaRange })} />
      )}

      {hasCh && (
        <div className="space-y-2">
          <div className="w-64">
            <Label className="text-xs">Calcium chloride product</Label>
            <Select value={product} onValueChange={v => setChosen(v as CalciumProduct)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="anhydrous">Anhydrous (94–97%)</SelectItem>
                <SelectItem value="dihydrate">Dihydrate / flake (77–80%)</SelectItem>
              </SelectContent>
            </Select>
            {!productKnown && <p className="mt-1 text-xs text-amber-700">Strength not confirmed — pick the type on the bag.</p>}
          </div>
          <DoseCard title="Calcium Hardness" target={chTarget} onTarget={setChTarget}
            r={calciumDose({ reading: calcium, gallons, target: num(chTarget), surface, product, productKnown, range: chRange })} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">Nothing here is logged as added. Record what you actually used under Chemicals Added.</p>
    </div>
  );
}
