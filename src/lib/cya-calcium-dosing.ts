/**
 * Stabilizer (CYA) and calcium hardness dose recommendations.
 * Recommendations only — never recorded as "added" chemicals.
 *
 * Dose rates (industry standard, per 10,000 gal per +10 ppm):
 *  - Cyanuric acid (dry stabilizer): 13 oz = 0.8125 lb  (≈ 1 lb per 12,000 gal)
 *  - Calcium chloride anhydrous (94–97%): 1.25 lb
 *  - Calcium chloride dihydrate (77–80%): 1.67 lb
 */

export const CYA_LB_PER_10K_PER_10PPM = 13 / 16;
export const CALCIUM_LB_PER_10K_PER_10PPM = { anhydrous: 1.25, dihydrate: 1.67 } as const;

export type CalciumProduct = 'anhydrous' | 'dihydrate';
export type PoolSurface = 'plaster' | 'vinyl' | 'fiberglass' | 'unknown';

export interface Target { min: number; max: number; target: number }

export interface DoseResult {
  status: 'low' | 'ok' | 'high' | 'no_reading' | 'needs_volume';
  current: number | null;
  target: number;
  range: Target;
  delta: number;           // ppm to raise (0 when at/above target)
  lbs: number | null;      // recommended amount; null when none or volume unknown
  oz: number | null;
  product: string;
  isEstimate: boolean;
  message: string;
  notes: string[];
}

/** Detect surface from stored liner_type / pool_type text. */
export function detectSurface(...fields: (string | null | undefined)[]): PoolSurface {
  const t = fields.filter(Boolean).join(' ').toLowerCase();
  if (/vinyl|liner/.test(t)) return 'vinyl';
  if (/fiberglass|fibreglass/.test(t)) return 'fiberglass';
  if (/plaster|gunite|concrete|shotcrete|pebble|quartz|marcite|tile/.test(t)) return 'plaster';
  return 'unknown';
}

export function isSaltPool(...fields: (string | null | undefined)[]): boolean {
  return /salt/.test(fields.filter(Boolean).join(' ').toLowerCase());
}

export function defaultCyaTarget(salt: boolean): Target {
  return salt ? { min: 60, max: 80, target: 70 } : { min: 30, max: 50, target: 40 };
}

export function defaultCalciumTarget(surface: PoolSurface): Target {
  switch (surface) {
    case 'plaster': return { min: 200, max: 400, target: 250 };
    case 'vinyl': return { min: 150, max: 250, target: 175 };
    case 'fiberglass': return { min: 150, max: 250, target: 200 };
    default: return { min: 150, max: 250, target: 175 };
  }
}

export function validGallons(g: unknown): number | null {
  const n = typeof g === 'string' ? Number(g) : (g as number);
  return typeof n === 'number' && Number.isFinite(n) && n >= 500 && n <= 2_000_000 ? n : null;
}

/** Round lbs to the nearest 0.25 lb (no false precision) and give whole ounces. */
function amounts(rawLbs: number) {
  const lbs = Math.max(0.25, Math.round(rawLbs * 4) / 4);
  return { lbs, oz: Math.round(lbs * 16) };
}

function validReading(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

export function cyaDose(opts: { reading: number | null | undefined; gallons: unknown; target?: number | null; salt?: boolean }): DoseResult {
  const range = defaultCyaTarget(!!opts.salt);
  const target = opts.target && opts.target > 0 ? opts.target : range.target;
  const current = validReading(opts.reading);
  const product = 'Cyanuric Acid (CYA / Stabilizer)';
  const notes = [
    'Dry stabilizer dissolves slowly — add in a skimmer sock or through the skimmer with the pump running; do not backwash for 3–5 days.',
    'Retest CYA about a week after adding before dosing again.',
  ];
  const base = { current, target, range, product, isEstimate: true, notes };
  if (current == null) return { ...base, status: 'no_reading', delta: 0, lbs: null, oz: null, message: 'Enter a CYA reading to see a dose.' };
  if (current > range.max) {
    return { ...base, status: 'high', delta: 0, lbs: null, oz: null,
      message: `CYA is high (${current} ppm). No chemical lowers CYA — partially drain and refill with fresh water.`,
      notes: ['High CYA weakens chlorine; raise free chlorine accordingly until the water is diluted.'] };
  }
  if (current >= target) {
    return { ...base, status: 'ok', delta: 0, lbs: null, oz: null, message: `CYA is at or above target (${current} / ${target} ppm). No stabilizer needed.`, notes: [] };
  }
  const delta = target - current;
  const gallons = validGallons(opts.gallons);
  if (gallons == null) {
    return { ...base, status: 'needs_volume', delta, lbs: null, oz: null, message: `CYA is ${delta} ppm below target. Enter the pool volume to calculate a dose.` };
  }
  const { lbs, oz } = amounts((delta / 10) * CYA_LB_PER_10K_PER_10PPM * (gallons / 10000));
  return { ...base, status: 'low', delta, lbs, oz, message: `Add ~${lbs} lb (${oz} oz) of stabilizer to raise CYA ${delta} ppm.` };
}

export function calciumDose(opts: {
  reading: number | null | undefined; gallons: unknown; target?: number | null;
  surface: PoolSurface; product: CalciumProduct; productKnown?: boolean;
}): DoseResult {
  const range = defaultCalciumTarget(opts.surface);
  const target = opts.target && opts.target > 0 ? opts.target : range.target;
  const current = validReading(opts.reading);
  const product = `Calcium Chloride (${opts.product === 'anhydrous' ? 'anhydrous 94–97%' : 'dihydrate 77–80%'})`;
  const notes = [
    'Calcium chloride gets hot as it dissolves — pre-dissolve in a bucket of pool water (add product to water, never water to product).',
    'Add per the product label, spread around the deep end with the pump running; add large doses in portions.',
  ];
  if (!opts.productKnown) notes.unshift('Estimate — product strength not confirmed. Check the bag and pick anhydrous or dihydrate.');
  if (opts.surface === 'vinyl' || opts.surface === 'fiberglass') {
    notes.push(`${opts.surface === 'vinyl' ? 'Vinyl' : 'Fiberglass'} pools don't need plaster-level hardness — only raise if below the ${range.min} ppm minimum.`);
  }
  if (opts.surface === 'unknown') notes.push('Pool surface unknown — using conservative vinyl-safe targets. Set the liner type on the customer for better targets.');
  const base = { current, target, range, product, isEstimate: true, notes };
  if (current == null) return { ...base, status: 'no_reading', delta: 0, lbs: null, oz: null, message: 'Enter a calcium hardness reading to see a dose.' };
  if (current > range.max) {
    return { ...base, status: 'high', delta: 0, lbs: null, oz: null,
      message: `Calcium hardness is high (${current} ppm). Do not add calcium; dilute with fresh water and keep pH/alkalinity low in range to avoid scale.`, notes: [] };
  }
  // Non-plaster surfaces: only raise when below minimum.
  const threshold = opts.surface === 'plaster' ? target : Math.min(target, range.min);
  if (current >= threshold) {
    return { ...base, status: 'ok', delta: 0, lbs: null, oz: null, message: `Calcium hardness is fine for this pool (${current} ppm, target ${target}). No calcium needed.`, notes: [] };
  }
  const delta = target - current;
  const gallons = validGallons(opts.gallons);
  if (gallons == null) {
    return { ...base, status: 'needs_volume', delta, lbs: null, oz: null, message: `Calcium is ${delta} ppm below target. Enter the pool volume to calculate a dose.` };
  }
  const rate = CALCIUM_LB_PER_10K_PER_10PPM[opts.product];
  const { lbs, oz } = amounts((delta / 10) * rate * (gallons / 10000));
  return { ...base, status: 'low', delta, lbs, oz,
    message: `${opts.productKnown ? '' : 'Estimate: '}Add ~${lbs} lb (${oz} oz) of ${product} to raise hardness ${delta} ppm.` };
}

/** Infer calcium chloride strength from a catalog/inventory label, if stated. */
export function calciumProductFromLabel(label: string | null | undefined): CalciumProduct | null {
  const t = (label ?? '').toLowerCase();
  if (/anhydrous|9[4-7]\s*%/.test(t)) return 'anhydrous';
  if (/dihydrate|7[7-8]\s*%|flake/.test(t)) return 'dihydrate';
  return null;
}
