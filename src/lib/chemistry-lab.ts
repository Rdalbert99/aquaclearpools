import { buildIdealChart, type ChartRow, type ChemKey, type LatestReadings, type PoolProfile } from './ideal-chemistry';
import { calciumDose, cyaDose, validGallons, type CalciumProduct } from './cya-calcium-dosing';
import { getDosageInstruction, type ChemicalId } from './pool-chemistry';
import { MANUAL_VERIFY } from './pool-chemistry';

export type LabStatus = 'in-range' | 'near-limit' | 'out-of-range' | 'unknown';
export const LAB_KEYS: ChemKey[] = ['fc', 'ph', 'ta', 'cya', 'ch', 'cc', 'salt', 'phosphates', 'iron', 'copper'];
/** Optional trace tests: shown only when selected or recorded. */
export const TRACE_KEYS: ChemKey[] = ['phosphates', 'iron', 'copper', 'metals'];
export const LAB_LABELS: Partial<Record<ChemKey, string>> = {
  fc: 'Free chlorine', ph: 'pH', ta: 'Alkalinity', cya: 'Stabilizer', ch: 'Calcium hardness', cc: 'Combined chlorine', salt: 'Salt',
  phosphates: 'Phosphates', iron: 'Iron', copper: 'Copper', metals: 'Total metals',
};
export const LAB_SHORT: Partial<Record<ChemKey, string>> = { fc: 'FC', ph: 'pH', ta: 'TA', cya: 'CYA', ch: 'CH', cc: 'CC', salt: 'Salt', phosphates: 'PO4', iron: 'Fe', copper: 'Cu', metals: 'Metals' };

/** Display scales represent concentration, never a health score; exact inputs are not clamped. */
export const LAB_SCALES: Record<ChemKey, { min: number; max: number }> = {
  fc: { min: 0, max: 20 }, cc: { min: 0, max: 2 }, ph: { min: 6.8, max: 8.2 },
  ta: { min: 0, max: 250 }, cya: { min: 0, max: 150 }, ch: { min: 0, max: 1000 }, salt: { min: 0, max: 6000 },
  phosphates: { min: 0, max: 2000 }, metals: { min: 0, max: 1 }, iron: { min: 0, max: 1 }, copper: { min: 0, max: 1 }, borates: { min: 0, max: 100 },
};

export function labStatus(row: ChartRow): { status: LabStatus; label: string } {
  if (row.latest == null || !row.range) return { status: 'unknown', label: row.latest == null ? 'Untested' : 'Target unknown' };
  if (row.status === 'low' || row.status === 'high') return { status: 'out-of-range', label: row.status === 'low' ? 'Low' : 'High' };
  const edge = (row.range.max - row.range.min) * 0.1;
  // Max-only parameters have a desirable zero, not a hazardous lower boundary.
  const maxOnly = row.key === 'cc' || TRACE_KEYS.includes(row.key);
  if ((!maxOnly && row.latest <= row.range.min + edge) || row.latest >= row.range.max - edge) {
    return { status: 'near-limit', label: 'Near limit' };
  }
  return { status: 'in-range', label: 'In range' };
}

export function scalePosition(key: ChemKey, value: number): number {
  const scale = LAB_SCALES[key];
  return Math.max(0, Math.min(100, (value - scale.min) / (scale.max - scale.min) * 100));
}

export function buildLabRows(profile: PoolProfile, readings: LatestReadings, selected?: ChemKey[]): ChartRow[] {
  const rows = buildIdealChart(profile, readings, selected ?? []);
  const keys = selected ?? [...LAB_KEYS, 'metals' as ChemKey].filter(k => k !== 'cc' && (k !== 'salt' || profile.sanitizer === 'salt')
    && (!TRACE_KEYS.includes(k) || (readings[k] != null && Number.isFinite(readings[k] as number))));
  return Array.from(new Set(keys)).flatMap(key => {
    const row = rows.find(r => r.key === key);
    return row ? [row] : [];
  });
}

/** Uses existing dose engines, passing the SAME pool-specific ranges as the reference chart. */
export function labAdvice(row: ChartRow, profile: PoolProfile, gallons?: number | null,
  product: CalciumProduct = 'dihydrate', productKnown = false): string[] {
  if (row.latest == null) return ['No reading recorded.'];
  if (!row.range) return ['A confirmed target is needed before recommending a dose.', ...row.notes];
  if (row.key === 'cya') {
    const result = cyaDose({ reading: row.latest, gallons, range: row.range, salt: profile.sanitizer === 'salt' });
    return [result.message, ...result.notes];
  }
  if (row.key === 'ch') {
    const result = calciumDose({ reading: row.latest, gallons, surface: profile.surface, range: row.range, product, productKnown });
    return [result.message, ...result.notes];
  }
  if (TRACE_KEYS.includes(row.key)) {
    if (row.status !== 'high') return ['Within the configured limit. No treatment indicated.', ...row.notes];
    const what = row.key === 'phosphates' ? 'phosphate remover' : 'metal sequestrant';
    return [`${row.name} is above ${row.rangeLabel.replace('≤ ', '')}. A ${what} amount needs the actual product, its label dose and pool gallons — ${MANUAL_VERIFY}.`, ...row.notes];
  }
  if (row.status === 'in_range') return ['Within the acceptable range. No adjustment recommended.', ...row.notes];
  if (validGallons(gallons) == null) return ['Pool volume is missing or invalid. Confirm gallons before calculating an amount.', ...row.notes];
  const ids: Partial<Record<ChemKey, ChemicalId>> = { fc: 'chlorine', ph: 'ph', ta: 'alkalinity', salt: 'salt' };
  const id = ids[row.key];
  if (!id) return row.notes.length ? row.notes : ['Follow the test kit and product label guidance.'];
  const advice = getDosageInstruction(id, row.latest, gallons ?? 0, row.range);
  return [advice ?? 'No adjustment recommended.', 'Estimate only. Follow the product label; retest before adding more.', ...row.notes];
}