// Pool chemical ideal ranges and dosage calculations

export type ChemicalId = 'ph' | 'alkalinity' | 'chlorine' | 'cya' | 'salt';

export interface ChemicalRange {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

export const CHEMICAL_RANGES: Record<ChemicalId, ChemicalRange> = {
  ph: { label: 'pH', unit: '', min: 7.2, max: 7.6, step: 0.1 },
  alkalinity: { label: 'Total Alkalinity', unit: 'ppm', min: 80, max: 120, step: 1 },
  chlorine: { label: 'Free Chlorine', unit: 'ppm', min: 1.0, max: 3.0, step: 0.1 },
  cya: { label: 'CYA', unit: 'ppm', min: 30, max: 50, step: 1 },
  salt: { label: 'Salt', unit: 'ppm', min: 2700, max: 3400, step: 100 },
};

export function isInRange(chemId: ChemicalId, value: number | null | undefined): 'in' | 'out' | 'none' {
  if (value == null || isNaN(value)) return 'none';
  const range = CHEMICAL_RANGES[chemId];
  return value >= range.min && value <= range.max ? 'in' : 'out';
}

/**
 * Reference constants — derived from stoichiometry (1 ppm in 10,000 US gal = 0.08345 lb):
 *  - Sodium bicarbonate: 1.40 lb / 10k gal / +10 ppm TA (as CaCO3)
 *  - Muriatic acid 31.45% (20° Bé): 25.6 fl oz / 10k gal / −10 ppm TA
 *  - Cal-hypo 65%: 2.05 oz / 10k gal / +1 ppm FC  (68–69%: ~1.95 oz)
 *  - Liquid chlorine 10%: 10.7 fl oz / 10k gal / +1 ppm FC; 12.5%: 8.5 fl oz
 *  - Pool salt (NaCl): 0.0834 lb / 10k gal / +1 ppm  (≈ 30 lb per +360 ppm)
 *  - Cyanuric acid (dry, ~99%): 13.3 oz / 10k gal / +10 ppm
 * pH correction is NOT linear (depends on TA, borates, temperature) — never given as a precise amount.
 */
export const BICARB_LB_PER_10K_PER_10PPM = 1.4;
export const MURIATIC_31_FLOZ_PER_10K_PER_10PPM_TA = 25.6;
export const CALHYPO65_OZ_PER_10K_PER_PPM = 2.05;
export const LIQUID_CHLORINE_FLOZ_PER_10K_PER_PPM = { '10': 10.7, '12.5': 8.5 } as const;
export const SALT_LB_PER_10K_PER_PPM = 0.08345;
export const MANUAL_VERIFY = 'Manual verification required';

export function validPoolGallons(g: unknown): number | null {
  const n = typeof g === 'string' ? Number(g) : (g as number);
  return typeof n === 'number' && Number.isFinite(n) && n >= 500 && n <= 2_000_000 ? n : null;
}

/**
 * Returns a plain-English dosage instruction when a reading is out of range.
 * Unknown/invalid gallons never produce an amount.
 */
export function getDosageInstruction(chemId: ChemicalId, value: number | null | undefined, poolGallons: number | null | undefined, poolRange?: { min: number; max: number; target?: number }): string | null {
  if (value == null || typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0) return `Reading ${value} is invalid (negative). Retest — ${MANUAL_VERIFY}.`;
  const range: { min: number; max: number; target?: number } = poolRange ?? CHEMICAL_RANGES[chemId];
  if (value >= range.min && value <= range.max) return null;
  const tgt = range.target != null && range.target >= range.min && range.target <= range.max ? range.target : null;

  if (chemId === 'ph') {
    return value < range.min
      ? `pH is low (${value}). Raise with soda ash (sodium carbonate) — the amount depends on alkalinity, so add a small partial dose per the label and retest. ${MANUAL_VERIFY}.`
      : `pH is high (${value}). Lower with muriatic acid or sodium bisulfate (dry acid) — the amount depends on alkalinity, so add a small partial dose per the label and retest. ${MANUAL_VERIFY}.`;
  }
  if (chemId === 'chlorine' && value > range.max) return `Chlorine is high (${value} ppm). Allow to dissipate naturally or dilute.`;
  if (chemId === 'cya' && value > range.max) return `CYA is high (${value} ppm). No chemical lowers CYA — partially drain and refill to dilute.`;
  if (chemId === 'salt' && value > range.max) return `Salt is high (${value} ppm). Partially drain and refill to dilute.`;

  const gallons = validPoolGallons(poolGallons);
  const label = { alkalinity: 'Alkalinity', chlorine: 'Chlorine', cya: 'CYA', salt: 'Salt' }[chemId];
  if (gallons == null) return `${label} is ${value < range.min ? 'low' : 'high'} (${value} ppm). Pool volume unknown — confirm gallons before calculating an amount.`;
  const factor = gallons / 10000;
  const round1 = (n: number) => Math.max(0.1, Math.round(n * 10) / 10);
  const raiseBy = (tgt ?? range.min) - value;
  const lowerBy = value - (tgt ?? range.max);

  switch (chemId) {
    case 'alkalinity':
      if (value < range.min) {
        const lbs = round1((raiseBy / 10) * BICARB_LB_PER_10K_PER_10PPM * factor);
        return `Alkalinity is low (${value} ppm). Add ~${lbs} lbs of sodium bicarbonate (baking soda, not soda ash) to raise TA ~${raiseBy} ppm.`;
      } else {
        const floz = (lowerBy / 10) * MURIATIC_31_FLOZ_PER_10K_PER_10PPM_TA * factor;
        return `Alkalinity is high (${value} ppm). ~${round1(floz / 128)} gal (${Math.round(floz)} fl oz) of 31.45% muriatic acid lowers TA ~${lowerBy} ppm — this also drops pH; add in portions with aeration and retest. ${MANUAL_VERIFY} for other acid strengths.`;
      }
    case 'chlorine': {
      const oz = raiseBy * CALHYPO65_OZ_PER_10K_PER_PPM * factor;
      return `Chlorine is low (${value} ppm). Add ~${round1(oz / 16)} lbs of granular cal-hypo (65%) to raise FC ~${Math.round(raiseBy * 10) / 10} ppm. Cal-hypo adds calcium; for other strengths ${MANUAL_VERIFY}.`;
    }
    case 'cya': {
      const lbs = round1((raiseBy / 10) * (13.3 / 16) * factor);
      return `CYA is low (${value} ppm). Add ~${lbs} lbs of stabilizer (cyanuric acid).`;
    }
    case 'salt': {
      const lbs = Math.ceil(raiseBy * SALT_LB_PER_10K_PER_PPM * factor);
      const bags = Math.ceil(lbs / 40);
      return `Salt is low (${value} ppm). Add ~${lbs} lbs of pool-grade salt (${bags} × 40 lb bag${bags > 1 ? 's' : ''}). Check the salt cell manufacturer's target.`;
    }
    default:
      return null;
  }
}

/** Exact decimal reading parse (voice/manual); rejects negatives, blanks, NaN; accepts "7,6". */
export function parseReadingValue(v: unknown): number | null {
  const s = String(v ?? '').trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
