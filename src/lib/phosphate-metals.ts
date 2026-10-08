/**
 * Phosphates (ppb as PO4) and metals (iron, copper in ppm).
 *
 * Safety rules:
 *  - Phosphate level is a nutrient/algae-pressure indicator only. It is NEVER
 *    used for sanitizer or swimmer-safety status — that comes from FC vs CYA.
 *  - No phosphate remover or metal sequestrant amount is ever derived from a
 *    reading alone. An amount is shown only when the actual product, its label
 *    dose (amount per gallons), the label's treatment context, and valid pool
 *    gallons are all supplied; otherwise "Manual verification required".
 *  - Sequestrants bind (hold) metals in solution; they do not remove them.
 */
import { MANUAL_VERIFY, validPoolGallons } from './pool-chemistry';
import type { PoolSurface } from './cya-calcium-dosing';

export const PPB_PER_PPM = 1000;
export type PhosphateUnit = 'ppb' | 'ppm';
export type TraceKey = 'phosphates' | 'iron' | 'copper';

/** Default guidance thresholds (configurable per pool via chemistry_targets). */
export const PHOSPHATE_DEFAULT_MAX_PPB = 500;
export const IRON_DEFAULT_MAX_PPM = 0.2;
export const COPPER_DEFAULT_MAX_PPM = 0.2;

/** Plausible upper bounds — values above are flagged for confirmation, never accepted silently. */
export const TRACE_PLAUSIBLE_MAX: Record<TraceKey, number> = { phosphates: 10000, iron: 5, copper: 5 };

export function ppmToPpb(ppm: number): number { return Math.round(ppm * PPB_PER_PPM * 1000) / 1000; }
export function ppbToPpm(ppb: number): number { return Math.round(ppb / PPB_PER_PPM * 1e6) / 1e6; }

/** Normalize a phosphate value to ppb PO4. Invalid/negative/blank → null. */
export function phosphateToPpb(value: unknown, unit: PhosphateUnit): number | null {
  const n = typeof value === 'string' ? Number(value.trim().replace(',', '.')) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || (typeof value === 'string' && !value.trim())) return null;
  return unit === 'ppm' ? ppmToPpb(n) : n;
}

export interface TraceCheck { value: number | null; flag: string | null }

/** Validate a trace reading; never auto-corrects, only flags. */
export function checkTraceReading(key: TraceKey, value: unknown): TraceCheck {
  if (value == null || value === '') return { value: null, flag: null };
  const n = typeof value === 'string' ? Number(value.trim().replace(',', '.')) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return { value: null, flag: 'Not a number — retest or re-enter.' };
  if (n < 0) return { value: null, flag: 'Negative readings are invalid — retest.' };
  if (n > TRACE_PLAUSIBLE_MAX[key]) return { value: n, flag: `${n} looks unusually high — confirm the reading and units.` };
  if (key === 'phosphates' && n > 0 && n < 5) {
    return { value: n, flag: `${n} ppb is very low — if the kit read ${n} ppm, that is ${ppmToPpb(n)} ppb.` };
  }
  return { value: n, flag: null };
}

export const PHOSPHATE_NOTES = [
  'Phosphates are algae food, not a sanitizer or swimmer-safety measure. Chlorine safety is judged by free chlorine vs CYA.',
  'Keeping free chlorine at the right level for the CYA controls algae even when phosphates are present.',
  'Kits read ppb or ppm as phosphate (PO4): 1 ppm = 1,000 ppb.',
];

export const METAL_METHOD_NOTES = [
  'Kit results show dissolved metal only — metal already deposited as stains is not measured.',
  'Colorimetric metal tests are approximate; high chlorine (above ~10 ppm) or color in the water can interfere. Retest if the result looks wrong.',
  'Iron and copper are tested separately; a combined "metals" value cannot tell which one is causing staining.',
];

/** Staining/surface alerts for measured metals. */
export function metalAlerts(key: 'iron' | 'copper' | 'metals', value: number | null, max: number, surface: PoolSurface): string[] {
  if (value == null || value <= max) return [];
  const out: string[] = [];
  if (key === 'iron') out.push(`Iron ${value} ppm is above ${max} ppm — brown, rust or orange staining and tinted water are likely, especially after shocking or raising pH.`);
  else if (key === 'copper') out.push(`Copper ${value} ppm is above ${max} ppm — blue-green or dark staining and green-tinted hair are possible. Check ionizers, copper algaecides and low pH corroding the heater.`);
  else out.push(`Total metals ${value} ppm is above ${max} ppm — test iron and copper separately to identify the source.`);
  if (surface === 'plaster') out.push('Plaster/gunite stains readily and stains can be hard to lift.');
  else if (surface === 'vinyl') out.push('Vinyl liners can stain permanently; check the liner maker’s guidance before using stain treatments.');
  else if (surface === 'fiberglass') out.push('Fiberglass can stain; use only products labelled safe for fiberglass.');
  else out.push('Surface unknown — set the pool surface to check product compatibility.');
  out.push('Avoid shocking or raising pH until metals are handled per the product label — oxidizing can drop metals out as stains.');
  return out;
}

export type TraceProduct = 'phosphate_remover' | 'sequestrant';
export type TreatmentContext = 'initial' | 'maintenance';

export interface TraceTreatmentInput {
  product: TraceProduct;
  reading: number | null | undefined;
  /** Upper acceptable limit for this pool (ppb for phosphates, ppm for metals). */
  max: number;
  gallons: number | null | undefined;
  /** Actual product name from the label. */
  productName?: string | null;
  /** Label dose amount for `labelGallons` gallons, in `labelUnit`. */
  labelAmount?: number | null;
  labelUnit?: string | null;
  labelGallons?: number | null;
  /** Which label line the dose comes from. */
  context?: TreatmentContext | null;
  /** Phosphate remover only: highest level (ppb) the label dose treats in one application. */
  labelCoversUpToPpb?: number | null;
  surface?: PoolSurface;
}

export interface TraceTreatmentResult { amount: number | null; unit: string | null; message: string; notes: string[]; manual: boolean }

const pos = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

export function traceTreatment(i: TraceTreatmentInput): TraceTreatmentResult {
  const isSeq = i.product === 'sequestrant';
  const notes = isSeq
    ? ['Sequestrants bind metals and hold them in solution — they do not remove them. Most need ongoing maintenance doses; draining/refilling or a metal-removal filter is the only true removal.']
    : ['Phosphate remover can briefly cloud the water; clean or backwash the filter afterwards. Retest before repeating.'];
  notes.push('Recommendation only — nothing is logged until you add what was actually used.');
  const manual = (why: string): TraceTreatmentResult => ({ amount: null, unit: null, message: `${why} ${MANUAL_VERIFY}.`, notes, manual: true });

  if (i.reading == null || !Number.isFinite(i.reading)) return manual('No valid reading.');
  if (i.reading < 0) return manual('Negative reading is invalid — retest.');
  if (i.reading <= i.max && (i.context ?? 'initial') === 'initial') {
    return { amount: null, unit: null, message: 'Within the configured limit. No initial treatment indicated.', notes, manual: false };
  }
  const gallons = validPoolGallons(i.gallons);
  if (gallons == null) return manual('Pool volume is missing or invalid.');
  if (!i.productName?.trim()) return manual('Select the actual product being used.');
  if (!pos(i.labelAmount) || !pos(i.labelGallons) || !i.labelUnit?.trim()) return manual('Enter the label dose (amount, unit and per how many gallons).');
  if (!i.context) return manual('Choose whether the label dose is the initial or maintenance dose.');
  if (!isSeq && i.context === 'initial') {
    if (!pos(i.labelCoversUpToPpb)) return manual('Enter the highest phosphate level the label dose treats.');
    if (i.reading > i.labelCoversUpToPpb) return manual(`Reading ${i.reading} ppb is above the ${i.labelCoversUpToPpb} ppb the label dose covers — follow the label for high levels.`);
  }
  if (isSeq && i.surface === 'unknown') notes.unshift('Surface unknown — confirm the product is labelled for this surface.');
  const amount = Math.round(i.labelAmount * (gallons / i.labelGallons) * 10) / 10;
  return {
    amount, unit: i.labelUnit.trim(),
    message: `${i.productName.trim()}: ~${amount} ${i.labelUnit.trim()} for ${gallons.toLocaleString()} gal (${i.context} label dose ${i.labelAmount} ${i.labelUnit.trim()} per ${i.labelGallons.toLocaleString()} gal).`,
    notes, manual: false,
  };
}
