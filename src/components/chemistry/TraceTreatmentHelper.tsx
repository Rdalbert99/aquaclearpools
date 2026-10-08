import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ChartRow, PoolProfile } from '@/lib/ideal-chemistry';
import { traceTreatment, type TreatmentContext } from '@/lib/phosphate-metals';
import { labAdvice } from '@/lib/chemistry-lab';

interface Props { row: ChartRow; profile: PoolProfile; gallons?: number | null }

/** Label-driven phosphate remover / sequestrant helper. Never logs a chemical. */
export function TraceTreatmentHelper({ row, profile, gallons }: Props) {
  const id = useId();
  const isPhos = row.key === 'phosphates';
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('');
  const [per, setPer] = useState('10000');
  const [covers, setCovers] = useState('');
  const [context, setContext] = useState<TreatmentContext | ''>('');
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
  const result = traceTreatment({
    product: isPhos ? 'phosphate_remover' : 'sequestrant', reading: row.latest, max: row.range?.max ?? 0,
    gallons, productName: name, labelAmount: num(amount), labelUnit: unit, labelGallons: num(per),
    labelCoversUpToPpb: num(covers), context: context || null, surface: profile.surface,
  });
  return (
    <div className="space-y-3 text-sm">
      <ul className="space-y-1">{labAdvice(row, profile, gallons).map(n => <li key={n}>{n}</li>)}</ul>
      <fieldset className="space-y-2 rounded-md border p-3">
        <legend className="px-1 text-xs font-semibold">{isPhos ? 'Phosphate remover — from the product label' : 'Metal sequestrant — from the product label'}</legend>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2"><Label htmlFor={`${id}-n`}>Product name</Label><Input id={`${id}-n`} value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label htmlFor={`${id}-a`}>Label amount</Label><Input id={`${id}-a`} inputMode="decimal" type="number" step="any" min="0" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div><Label htmlFor={`${id}-u`}>Unit</Label><Input id={`${id}-u`} placeholder="fl oz" value={unit} onChange={e => setUnit(e.target.value)} /></div>
          <div><Label htmlFor={`${id}-g`}>Per gallons</Label><Input id={`${id}-g`} inputMode="numeric" type="number" min="0" value={per} onChange={e => setPer(e.target.value)} /></div>
          <div><Label htmlFor={`${id}-c`}>Label dose type</Label>
            <Select value={context} onValueChange={v => setContext(v as TreatmentContext)}>
              <SelectTrigger id={`${id}-c`}><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent><SelectItem value="initial">Initial treatment</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem></SelectContent>
            </Select>
          </div>
          {isPhos && context === 'initial' && (
            <div className="col-span-2"><Label htmlFor={`${id}-p`}>Label dose treats up to (ppb)</Label><Input id={`${id}-p`} inputMode="numeric" type="number" min="0" value={covers} onChange={e => setCovers(e.target.value)} /></div>
          )}
        </div>
        <p className={result.manual ? 'font-medium text-destructive' : 'font-medium'} role="status">{result.message}</p>
        <ul className="space-y-1 text-xs text-muted-foreground">{result.notes.map(n => <li key={n}>{n}</li>)}</ul>
      </fieldset>
    </div>
  );
}
