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
 * Returns a plain-English dosage instruction when a reading is out of range.
 * poolGallons is the pool size in gallons.
 */
export function getDosageInstruction(chemId: ChemicalId, value: number | null | undefined, poolGallons: number): string | null {
  if (value == null || isNaN(value)) return null;
  const range = CHEMICAL_RANGES[chemId];
  if (value >= range.min && value <= range.max) return null;

  // Normalize pool size to 10,000-gallon units for dosage math
  const factor = poolGallons / 10000;

  switch (chemId) {
    case 'ph': {
      if (value < range.min) {
        // pH too low → add soda ash (sodium carbonate). ~6 oz per 10k gal raises pH ~0.2
        const deficit = range.min - value;
        const doses = Math.ceil(deficit / 0.2);
        const oz = (doses * 6 * factor).toFixed(1);
        return `pH is low (${value}). Add ~${oz} oz of soda ash to raise pH.`;
      } else {
        // pH too high → add muriatic acid. ~12 oz per 10k gal lowers pH ~0.2
        const excess = value - range.max;
        const doses = Math.ceil(excess / 0.2);
        const oz = (doses * 12 * factor).toFixed(1);
        return `pH is high (${value}). Add ~${oz} oz of muriatic acid to lower pH.`;
      }
    }

    case 'alkalinity': {
      if (value < range.min) {
        // TA too low → add sodium bicarbonate (baking soda). ~1.5 lbs per 10k gal raises TA ~10 ppm
        const deficit = range.min - value;
        const doses = Math.ceil(deficit / 10);
        const lbs = (doses * 1.5 * factor).toFixed(1);
        return `Alkalinity is low (${value} ppm). Add ~${lbs} lbs of sodium bicarbonate.`;
      } else {
        // TA too high → add muriatic acid. ~26 oz per 10k gal lowers TA ~10 ppm
        const excess = value - range.max;
        const doses = Math.ceil(excess / 10);
        const oz = (doses * 26 * factor).toFixed(1);
        return `Alkalinity is high (${value} ppm). Add ~${oz} oz of muriatic acid.`;
      }
    }

    case 'chlorine': {
      if (value < range.min) {
        // FC too low → add cal-hypo (65%). ~2 oz per 10k gal raises FC ~1 ppm
        const deficit = range.min - value;
        const doses = Math.ceil(deficit / 1);
        const oz = (doses * 2 * factor).toFixed(1);
        return `Chlorine is low (${value} ppm). Add ~${oz} oz of cal-hypo (65%).`;
      } else {
        return `Chlorine is high (${value} ppm). Allow to dissipate naturally or dilute.`;
      }
    }

    case 'cya': {
      if (value < range.min) {
        // CYA too low → add stabilizer (cyanuric acid). ~13 oz per 10k gal raises CYA ~10 ppm
        const deficit = range.min - value;
        const doses = Math.ceil(deficit / 10);
        const oz = (doses * 13 * factor).toFixed(1);
        return `CYA is low (${value} ppm). Add ~${oz} oz of stabilizer (cyanuric acid).`;
      } else {
        return `CYA is high (${value} ppm). Partially drain and refill to dilute.`;
      }
    }

    case 'salt': {
      if (value < range.min) {
        // Salt too low → add pool salt. ~30 lbs per 10k gal raises salt ~360 ppm
        const deficit = range.min - value;
        const lbs = Math.ceil((deficit / 360) * 30 * factor);
        return `Salt is low (${value} ppm). Add ~${lbs} lbs of pool-grade salt.`;
      } else {
        return `Salt is high (${value} ppm). Partially drain and refill to dilute.`;
      }
    }

    default:
      return null;
  }
}
