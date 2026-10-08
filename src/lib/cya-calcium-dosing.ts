/**
 * Stabilizer (CYA) and calcium hardness dose recommendations.
 * Recommendations only — never recorded as "added" chemicals.
 *
 * Dose rates (industry standard, per 10,000 gal per +10 ppm):
 *  - Cyanuric acid (dry stabilizer): 13 oz = 0.8125 lb  (≈ 1 lb per 12,000 gal)
 *  - Calcium chloride anhydrous (94%): 0.98 lb   (0.8345 lb CaCO3 × 110.98/100.09 ÷ 0.94)
 *  - Calcium chloride dihydrate (77% CaCl2): 1.20 lb
 *  (Previous 1.25 / 1.67 values overdosed by ~27% / ~39%.)
 * Aqua Clear's default product is calcium chloride FLAKE (dihydrate, ~77–80% CaCl2).
 * Unconfirmed strength → dihydrate 77% estimate, clearly labelled, with a prompt to verify the bag.
 * A label % CaCl2 (when entered) overrides the table rate: lb = PURE_CACL2 / (pct/100).
 */
/** lb of 100% CaCl2 per 10k gal per +10 ppm CH (as CaCO3): 0.8345 × 110.98 / 100.09. */
export const PURE_CACL2_LB_PER_10K_PER_10PPM = 0.8345 * 110.98 / 100.09;
export const DEFAULT_CALCIUM_PRODUCT = 'dihydrate' as const;
/** Plausible label strength per product; outside → manual verification. */
export const CALCIUM_PURITY_RANGE = { anhydrous: [90, 100], dihydrate: [70, 85], dowflake_xtra: [83, 87] } as const;

/**
 * Aqua Clear's preferred bag: OxyChem DOWFLAKE Xtra calcium chloride flakes, label "83–87% PURE", 50 lb.
 * The label gives a RANGE, so doses are a range: start amount at 87% (less product, conservative)
 * up to the 83% amount. Label also says not for food/drug use and the product is not assumed
 * approved for pool treatment — amounts stay hidden until the tech confirms pool suitability.
 */
export const PREFERRED_CALCIUM_PRODUCT = 'dowflake_xtra' as const;
export const DOWFLAKE_XTRA = {
  label: 'OxyChem DOWFLAKE Xtra calcium chloride flakes',
  manufacturer: 'Occidental Chemical Corporation (OxyChem)',
  purityMin: 83, purityMax: 87, bagLb: 50, bagKg: 22.68,
} as const;
export const DOWFLAKE_SUITABILITY_KEY = 'aq.dowflakeXtra.poolSuitabilityVerified';
export function getDowflakeSuitability(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(DOWFLAKE_SUITABILITY_KEY) === 'yes'; } catch { return false; }
}
export function setDowflakeSuitability(v: boolean) {
  try { if (v) localStorage.setItem(DOWFLAKE_SUITABILITY_KEY, 'yes'); else localStorage.removeItem(DOWFLAKE_SUITABILITY_KEY); } catch { /* ignore */ }
}

export const CYA_LB_PER_10K_PER_10PPM = 13 / 16;
export const CALCIUM_LB_PER_10K_PER_10PPM = { anhydrous: 0.98, dihydrate: 1.20 } as const;

export type CalciumProduct = 'anhydrous' | 'dihydrate' | 'dowflake_xtra';
export type PoolSurface = 'plaster' | 'vinyl' | 'fiberglass' | 'unknown';

export interface Target { min: number; max: number; target: number }

export interface DoseResult {
  status: 'low' | 'ok' | 'high' | 'no_reading' | 'needs_volume';
  current: number | null;
  target: number;
  range: Target;
  delta: number;           // ppm to raise (0 when at/above target)
  lbs: number | null;      // recommended amount; null when none or volume unknown
  /** Upper end when the label gives a strength range (lbs = start/conservative amount). */
  lbsMax?: number | null;
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

export function cyaDose(opts: { reading: number | null | undefined; gallons: unknown; target?: number | null; salt?: boolean; range?: Target }): DoseResult {
  const range = opts.range ?? defaultCyaTarget(!!opts.salt);
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
  surface: PoolSurface; product: CalciumProduct; productKnown?: boolean; range?: Target;
  /** % CaCl2 printed on the bag, if entered. */
  purityPct?: number | null;
  /** Tech confirmed the bag/manufacturer says the product is suitable for pool use (DOWFLAKE Xtra). */
  suitabilityVerified?: boolean;
}): DoseResult {
  if (opts.product === 'dowflake_xtra') return dowflakeDose(opts);
  const range = opts.range ?? defaultCalciumTarget(opts.surface);
  const target = opts.target && opts.target > 0 ? opts.target : range.target;
  const current = validReading(opts.reading);
  const effProduct = (opts.productKnown ? opts.product : DEFAULT_CALCIUM_PRODUCT) as 'anhydrous' | 'dihydrate';
  const [pMin, pMax] = CALCIUM_PURITY_RANGE[effProduct];
  const pctGiven = opts.purityPct != null && opts.purityPct !== 0;
  const pctValid = pctGiven && Number.isFinite(opts.purityPct!) && opts.purityPct! >= pMin && opts.purityPct! <= pMax;
  const product = opts.productKnown
    ? `Calcium Chloride (${opts.product === 'anhydrous' ? 'anhydrous' : 'flake / dihydrate'} ${pctValid ? `${opts.purityPct}%` : opts.product === 'anhydrous' ? '94–97%' : '77–80%'})`
    : 'Calcium Chloride flake (dihydrate, strength unconfirmed)';
  const notes = [
    'Calcium chloride gets hot as it dissolves — pre-dissolve in a bucket of pool water (add product to water, never water to product).',
    'Add per the product label, spread around the deep end with the pump running; add large doses in portions.',
  ];
  if (!opts.productKnown) notes.unshift('Estimate — assumes Aqua Clear\'s usual calcium chloride flake (dihydrate, 77%). Verify the bag: if it says anhydrous (94–97%), use about 18% less. Manual verification required.');
  else if (pctGiven && !pctValid) notes.unshift(`Label strength ${opts.purityPct}% doesn't match ${effProduct} (${pMin}–${pMax}%). Manual verification required — check the bag; using the standard ${effProduct} rate.`);
  else if (!pctGiven) notes.unshift(`Using the typical ${effProduct === 'anhydrous' ? '94%' : '77%'} strength. Enter the % on the bag for an exact figure.`);
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
  const rate = opts.productKnown && pctValid ? PURE_CACL2_LB_PER_10K_PER_10PPM / (opts.purityPct! / 100) : CALCIUM_LB_PER_10K_PER_10PPM[effProduct];
  const { lbs, oz } = amounts((delta / 10) * rate * (gallons / 10000));
  return { ...base, status: 'low', delta, lbs, oz,
    message: `${opts.productKnown ? '' : 'Estimate (verify bag strength): '}Add ~${lbs} lb (${oz} oz) of ${product} to raise hardness ${delta} ppm.` };
}

function dowflakeDose(opts: Parameters<typeof calciumDose>[0]): DoseResult {
  const generic = calciumDose({ ...opts, product: 'dihydrate', productKnown: true, purityPct: null });
  const { purityMin, purityMax } = DOWFLAKE_XTRA;
  const pct = opts.purityPct;
  const pctGiven = pct != null && pct !== 0;
  const pctValid = pctGiven && Number.isFinite(pct!) && pct! >= purityMin && pct! <= purityMax;
  const product = `${DOWFLAKE_XTRA.label} (${pctValid ? `${pct}%` : `${purityMin}–${purityMax}%`} CaCl2, 50 lb bag)`;
  const notes = [
    'Calcium chloride gets hot as it dissolves — pre-dissolve in a bucket of pool water (add product to water, never water to product).',
    'Add in portions with the pump running, spread around the deep end, and retest before adding more.',
    `Label says "${purityMin}–${purityMax}% PURE" and "not for food or drug use". It is not assumed to be approved for pool treatment — confirm with the label or manufacturer (OxyChem) before use.`,
  ];
  if (pctGiven && !pctValid) notes.unshift(`Entered strength ${pct}% is outside the bag's ${purityMin}–${purityMax}% label range. Manual verification required — showing the label-range dose.`);
  else if (!pctGiven) notes.unshift(`Exact strength varies by lot (${purityMin}–${purityMax}%). Start with the lower amount (based on ${purityMax}%), retest, then add more only if needed.`);
  if (opts.surface !== 'plaster') notes.push(...generic.notes.filter(n => /pools don't need|surface unknown/.test(n)));
  const base = { ...generic, product, notes: generic.status === 'low' || generic.status === 'needs_volume' ? notes : generic.notes, lbsMax: null };
  if (generic.status !== 'low') return { ...base, message: generic.message.replace(/calcium chloride flake[^.]*|Calcium Chloride \([^)]*\)/i, product) };
  const gallons = validGallons(opts.gallons)!;
  const pureLb = (generic.delta / 10) * PURE_CACL2_LB_PER_10K_PER_10PPM * (gallons / 10000);
  if (!opts.suitabilityVerified) {
    return { ...base, lbs: null, oz: null, isEstimate: true,
      message: `Calcium is ${generic.delta} ppm below target. Manual verification required: confirm the DOWFLAKE Xtra label or manufacturer says it is suitable for swimming pool use before an amount is shown.` };
  }
  if (pctValid) {
    const { lbs, oz } = amounts(pureLb / (pct! / 100));
    return { ...base, lbs, oz, isEstimate: false, message: `Add ~${lbs} lb (${oz} oz) of ${product} to raise hardness ${generic.delta} ppm.` };
  }
  const lbs = Math.max(0.25, Math.floor((pureLb / (purityMax / 100)) * 4) / 4);
  const lbsMax = Math.max(lbs, Math.ceil((pureLb / (purityMin / 100)) * 4) / 4);
  return { ...base, lbs, lbsMax, oz: Math.round(lbs * 16), isEstimate: true,
    message: `Add ${lbs}–${lbsMax} lb of ${product} to raise hardness ${generic.delta} ppm. Start with ${lbs} lb, retest, then add more only if needed.` };
}

/** Infer calcium chloride strength from a catalog/inventory label, if stated. */
export function calciumProductFromLabel(label: string | null | undefined): CalciumProduct | null {
  const t = (label ?? '').toLowerCase();
  if (/dowflake|8[3-7]\s*[-–]\s*8[3-7]\s*%/.test(t)) return 'dowflake_xtra';
  if (/anhydrous|9[4-7]\s*%/.test(t)) return 'anhydrous';
  if (/dihydrate|7[7-8]\s*%|flake/.test(t)) return 'dihydrate';
  return null;
}
