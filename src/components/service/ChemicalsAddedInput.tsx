import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import {
  ChemicalEntry,
  ChemicalUnit,
  getChemicalOption,
  newChemicalEntry,
} from '@/lib/chemicals-added';
import { useChemicalCatalog } from '@/hooks/useChemicalCatalog';

interface Props {
  value: ChemicalEntry[];
  onChange: (entries: ChemicalEntry[]) => void;
}

export function ChemicalsAddedInput({ value, onChange }: Props) {
  const { options: CATALOG } = useChemicalCatalog();
  const entries = value.length ? value : [];

  const update = (i: number, patch: Partial<ChemicalEntry>) => {
    const next = entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e));
    onChange(next);
  };

  const add = () => onChange([...entries, newChemicalEntry()]);
  const remove = (i: number) => onChange(entries.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No chemicals added. Click "Add chemical" if you treated the pool.
        </p>
      )}

      {entries.map((entry, i) => {
        const opt = getChemicalOption(entry.chemicalId);
        const units = opt?.units ?? (['lbs', 'oz', 'gal', 'qt'] as ChemicalUnit[]);
        return (
          <div
            key={i}
            className="rounded-lg border bg-card p-3 space-y-2"
          >
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-12 sm:col-span-6">
                <Label className="text-xs">Chemical</Label>
                <Select
                  value={entry.chemicalId}
                  onValueChange={(id) => {
                    const newOpt = getChemicalOption(id);
                    update(i, {
                      chemicalId: id,
                      unit: newOpt?.units[0] ?? entry.unit,
                      otherName: id === 'other' ? entry.otherName ?? '' : undefined,
                    });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHEMICAL_OPTIONS.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-6 sm:col-span-3">
                <Label className="text-xs">Amount</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={entry.amount}
                  onChange={(e) => update(i, { amount: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div className="col-span-4 sm:col-span-2">
                <Label className="text-xs">Unit</Label>
                <Select
                  value={entry.unit}
                  onValueChange={(u) => update(i, { unit: u as ChemicalUnit })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {units.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 sm:col-span-1 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(i)}
                  aria-label="Remove chemical"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {entry.chemicalId === 'other' && (
              <div>
                <Label className="text-xs">What was added?</Label>
                <Input
                  value={entry.otherName ?? ''}
                  onChange={(e) => update(i, { otherName: e.target.value })}
                  placeholder="Name of the chemical"
                />
              </div>
            )}

            {opt?.purpose && (
              <p className="text-xs text-muted-foreground">{opt.purpose}</p>
            )}
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4 mr-2" /> Add chemical
      </Button>
    </div>
  );
}
