import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildLabRows, LAB_LABELS, LAB_SCALES, LAB_SHORT, labAdvice, labStatus, scalePosition } from '@/lib/chemistry-lab';
import type { ChartRow, ChemKey, LatestReadings, PoolProfile } from '@/lib/ideal-chemistry';

interface Props {
  profile: PoolProfile;
  readings: LatestReadings;
  selected?: ChemKey[];
  gallons?: number | null;
  onReadingChange?: (key: ChemKey, value: number | null) => void;
  latestDate?: string | null;
  renderAdvice?: (row: ChartRow) => ReactNode;
}

export function ChemistryLab({ profile, readings, selected, gallons, onReadingChange, latestDate, renderAdvice }: Props) {
  const id = useId();
  const [expanded, setExpanded] = useState<ChemKey | null>(null);
  const rows = buildLabRows(profile, readings, selected);
  const active = rows.find(r => r.key === expanded);
  const historical = !onReadingChange;
  return (
    <section className="chemistry-lab" aria-label="Aqua Clear Chemistry Lab">
      <header className="lab-header">
        <div className="flex min-w-0 items-center gap-2">
          <FlaskConical className="h-5 w-5 shrink-0" aria-hidden="true" />
          <h3 className="text-base font-semibold">Aqua Clear Chemistry Lab</h3>
        </div>
        <span className="text-xs">{historical ? 'Last recorded' : 'Current visit'}</span>
      </header>
      <div className="lab-context">
        <span>{gallons && gallons > 0 ? `${gallons.toLocaleString()} gal` : 'Volume unknown'}</span>
        <span>{profile.sanitizer === 'salt' ? 'Saltwater generator' : profile.sanitizer === 'chlorine' ? 'Manual chlorine' : 'Sanitizer unknown'}</span>
        <span>{profile.surface === 'unknown' ? 'Surface unknown' : profile.surface === 'plaster' ? 'Plaster / gunite' : profile.surface === 'vinyl' ? 'Vinyl' : 'Fiberglass'}</span>
        {historical && latestDate && <time dateTime={latestDate}>{new Date(latestDate).toLocaleDateString()}</time>}
      </div>
      <div className="lab-rack" style={{ '--lab-count': rows.length } as CSSProperties}>
        {rows.map(row => {
          const status = labStatus(row);
          const scale = LAB_SCALES[row.key];
          const style = {
            '--lab-level': `${row.latest == null ? 0 : scalePosition(row.key, row.latest)}%`,
            '--lab-band-bottom': `${row.range ? scalePosition(row.key, row.range.min) : 0}%`,
            '--lab-band-height': `${row.range ? Math.max(1, scalePosition(row.key, row.range.max) - scalePosition(row.key, row.range.min)) : 0}%`,
          } as CSSProperties;
          return (
            <div className="lab-slot" data-status={status.status} key={row.key}>
              <label htmlFor={`${id}-${row.key}`} className="lab-label">{LAB_SHORT[row.key] ?? row.name}</label>
              <Button type="button" variant="ghost" className="lab-well-button" style={style}
                aria-label={`${row.name}: ${row.latest ?? 'untested'}. ${status.label}. Show ideal range and dosage advice`}
                aria-expanded={expanded === row.key} aria-controls={`${id}-detail`}
                onClick={() => setExpanded(prev => prev === row.key ? null : row.key)}>
                <span className="lab-well" aria-hidden="true">
                  <span className="lab-fluid" />
                  {row.range && <span className="lab-ideal-band" />}
                  <span className="lab-ticks" />
                </span>
                <span className="lab-scale" aria-hidden="true">{scale.min}–{scale.max}</span>
              </Button>
              {onReadingChange ? (
                <Input id={`${id}-${row.key}`} type="number" inputMode="decimal" step="any" min="0"
                  aria-label={`${row.name} reading${row.unit ? ` in ${row.unit}` : ''}`}
                  aria-describedby={`${id}-${row.key}-status`} className="lab-input"
                  value={row.latest ?? ''} placeholder="—"
                  onChange={e => {
                    const v = e.target.value === '' ? null : Number(e.target.value);
                    onReadingChange(row.key, v != null && (!Number.isFinite(v) || v < 0) ? null : v);
                  }} />
              ) : <output id={`${id}-${row.key}`} className="lab-value">{row.latest ?? '—'}</output>}
              <span className="lab-unit">{row.unit || 'pH units'}</span>
              <span id={`${id}-${row.key}-status`} className="lab-status">{status.label}</span>
              <span className="lab-name">{LAB_LABELS[row.key] ?? row.name}</span>
              <span className="lab-range">Ideal {row.rangeLabel}</span>
            </div>
          );
        })}
      </div>
      <div className="lab-base"><span>{historical ? 'Historical readings' : 'Water analysis'}</span><span>Ideal band <span className="lab-band-key" aria-hidden="true" /></span></div>
      {active && (
        <div id={`${id}-detail`} className="lab-detail" role="region" aria-label={`${active.name} details`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold">{active.name}</h4>
              <p className="text-sm">Target {active.targetLabel} · Acceptable {active.rangeLabel}{active.isCustom ? ' · Custom' : ''}</p>
              <p className="text-xs text-muted-foreground">{active.basis}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setExpanded(null)} aria-label="Close chemistry details"><ChevronDown className="rotate-180" /></Button>
          </div>
          {historical ? <ul className="space-y-1 text-sm text-muted-foreground">{active.notes.map(note => <li key={note}>{note}</li>)}</ul> : (
            renderAdvice?.(active) ?? <ul className="space-y-1 text-sm">{labAdvice(active, profile, gallons).map(note => <li key={note}>{note}</li>)}</ul>
          )}
          {!historical && <p className="text-xs text-muted-foreground">Recommendation only · Actual chemicals added remain separate.</p>}
        </div>
      )}
    </section>
  );
}