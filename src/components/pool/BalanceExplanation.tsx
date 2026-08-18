import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, CheckCircle2, ChevronDown, Settings2 } from 'lucide-react';
import { CHEMICAL_RANGES, type ChemicalId } from '@/lib/pool-chemistry';
import {
  DEFAULT_TOLERANCES,
  setBalanceTolerances,
  type BalanceStatus,
  type BalanceTolerances,
} from '@/lib/pool-status';

interface Props {
  status: BalanceStatus;
  /** Called after tolerances change so the parent can recompute. */
  onTolerancesChange?: (t: BalanceTolerances) => void;
}

function ToleranceSettings({ current, onChange }: { current: BalanceTolerances; onChange?: (t: BalanceTolerances) => void }) {
  const [draft, setDraft] = useState<Record<ChemicalId, string>>(() => {
    const d = {} as Record<ChemicalId, string>;
    (Object.keys(CHEMICAL_RANGES) as ChemicalId[]).forEach(id => { d[id] = String(current[id]); });
    return d;
  });

  const save = () => {
    const next: Partial<BalanceTolerances> = {};
    (Object.keys(CHEMICAL_RANGES) as ChemicalId[]).forEach(id => {
      const n = parseFloat(draft[id]);
      if (!isNaN(n) && n >= 0) next[id] = n;
    });
    onChange?.(setBalanceTolerances(next));
  };

  const reset = () => {
    const d = {} as Record<ChemicalId, string>;
    (Object.keys(DEFAULT_TOLERANCES) as ChemicalId[]).forEach(id => { d[id] = String(DEFAULT_TOLERANCES[id]); });
    setDraft(d);
    onChange?.(setBalanceTolerances(DEFAULT_TOLERANCES));
  };

  return (
    <PopoverContent className="w-72 z-50 bg-popover" align="end">
      <p className="text-sm font-medium">Test-kit tolerance</p>
      <p className="text-xs text-muted-foreground mb-3">
        Readings this far outside the ideal range still count as balanced.
      </p>
      <div className="space-y-2">
        {(Object.keys(CHEMICAL_RANGES) as ChemicalId[]).map(id => (
          <div key={id} className="flex items-center justify-between gap-2">
            <Label htmlFor={`tol-${id}`} className="text-xs">
              {CHEMICAL_RANGES[id].label}
              {CHEMICAL_RANGES[id].unit ? ` (${CHEMICAL_RANGES[id].unit})` : ''}
            </Label>
            <Input
              id={`tol-${id}`}
              type="number"
              min={0}
              step={CHEMICAL_RANGES[id].step}
              className="h-8 w-24"
              value={draft[id]}
              onChange={e => setDraft(prev => ({ ...prev, [id]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" className="flex-1" onClick={save}>Save</Button>
        <Button size="sm" variant="outline" onClick={reset}>Reset</Button>
      </div>
    </PopoverContent>
  );
}

/** Shows the balance verdict plus the readings and dose matches behind it. */
export function BalanceExplanation({ status, onTolerancesChange }: Props) {
  const [open, setOpen] = useState(false);
  const rows = [...status.outOfRange, ...status.inRange];

  return (
    <div>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-muted-foreground">Currently In Balance</p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Tolerance settings">
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <ToleranceSettings current={status.tolerances} onChange={onTolerancesChange} />
        </Popover>
      </div>

      <Badge variant={status.inBalance ? 'default' : 'destructive'}>
        {status.inBalance ? 'Balanced' : 'Out of balance'}
      </Badge>
      <p className="mt-1 text-xs text-muted-foreground">{status.summary}</p>

      {status.unresolved.length > 0 && (
        <div className="mt-2 space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-2">
          {status.unresolved.map(r => (
            <div key={r.chemId} className="flex gap-2 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium">{r.explanation}</p>
                {r.missingReason && <p className="text-muted-foreground">{r.missingReason}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <ChevronDown className={`mr-1 h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
              {open ? 'Hide' : 'Why this result?'}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 space-y-1.5">
            {rows.map(r => (
              <div key={r.chemId} className="rounded-md border p-2 text-xs">
                <div className="flex items-center gap-1.5 font-medium">
                  {r.addressed
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    : <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                  <span>{r.label}: {r.value}{r.unit ? ` ${r.unit}` : ''}</span>
                  <span className="text-muted-foreground">
                    ideal {r.idealMin}–{r.idealMax}
                    {r.toleranceApplied ? ` (±${r.toleranceApplied})` : ''}
                  </span>
                </div>
                <p className="mt-0.5 text-muted-foreground">{r.explanation}</p>
                {r.matchedText && (
                  <p className="mt-0.5 text-muted-foreground">
                    Matched in <span className="font-medium">{r.matchedSource}</span>: “{r.matchedText}”
                  </p>
                )}
                {r.missingReason && <p className="mt-0.5 text-destructive">{r.missingReason}</p>}
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Records searched: {status.searchedSources.length ? status.searchedSources.join(', ') : 'none available'}
            </p>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export default BalanceExplanation;
