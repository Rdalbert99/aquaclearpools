// Pool Health Score (0-100) — a single number a tech can read at a glance.
//
// Deductions come from four areas: chemistry deviation, open equipment issues,
// overdue service, and salt-cell maintenance. The score is intentionally simple
// and deterministic so it can be recomputed later from stored visit snapshots.

import { CHEMICAL_RANGES, type ChemicalId } from './pool-chemistry';

export type HealthBand = 'excellent' | 'good' | 'watch' | 'critical';

export interface HealthInput {
  readings?: Partial<Record<ChemicalId, number | null>>;
  openEquipmentIssues?: number;
  /** Days past the scheduled service date. Negative / 0 = not overdue. */
  daysOverdue?: number;
  /** Days since the salt cell was last cleaned (null when not a salt pool). */
  saltCellDays?: number | null;
}

export interface HealthResult {
  score: number;
  band: HealthBand;
  /** Tailwind text/border/bg classes for the band. */
  color: string;
  badgeClass: string;
  label: string;
  reasons: string[];
}

/** How far out of range a reading is, as a fraction of the ideal window width. */
function deviationRatio(chemId: ChemicalId, value: number): number {
  const r = CHEMICAL_RANGES[chemId];
  const width = Math.max(r.max - r.min, 0.0001);
  if (value < r.min) return (r.min - value) / width;
  if (value > r.max) return (value - r.max) / width;
  return 0;
}

/** Max points a single reading can subtract. */
const CHEM_WEIGHT: Record<ChemicalId, number> = {
  chlorine: 22,
  ph: 18,
  alkalinity: 12,
  cya: 8,
  salt: 8,
};

export function bandFor(score: number): HealthBand {
  if (score >= 85) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'watch';
  return 'critical';
}

const BAND_META: Record<HealthBand, { color: string; badgeClass: string; label: string }> = {
  excellent: {
    color: 'text-emerald-600',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
    label: 'Healthy',
  },
  good: {
    color: 'text-amber-600',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40',
    label: 'Minor issues',
  },
  watch: {
    color: 'text-orange-600',
    badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40',
    label: 'Needs attention',
  },
  critical: {
    color: 'text-red-600',
    badgeClass: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40',
    label: 'Action required',
  },
};

export function calculatePoolHealth(input: HealthInput): HealthResult {
  const reasons: string[] = [];
  let score = 100;

  const readings = input.readings ?? {};
  (Object.keys(CHEM_WEIGHT) as ChemicalId[]).forEach(chemId => {
    const value = readings[chemId];
    if (value == null || Number.isNaN(value)) return;
    const ratio = deviationRatio(chemId, value);
    if (ratio <= 0) return;
    // A full window off the ideal range costs the whole weight; capped there.
    const penalty = Math.min(CHEM_WEIGHT[chemId], Math.round(CHEM_WEIGHT[chemId] * Math.min(ratio, 1)));
    if (penalty > 0) {
      score -= penalty;
      reasons.push(`${CHEMICAL_RANGES[chemId].label} out of range (-${penalty})`);
    }
  });

  const issues = input.openEquipmentIssues ?? 0;
  if (issues > 0) {
    const penalty = Math.min(20, issues * 10);
    score -= penalty;
    reasons.push(`${issues} open equipment issue${issues > 1 ? 's' : ''} (-${penalty})`);
  }

  const overdue = input.daysOverdue ?? 0;
  if (overdue > 0) {
    const penalty = Math.min(20, Math.ceil(overdue / 3) * 5);
    score -= penalty;
    reasons.push(`${overdue} day${overdue > 1 ? 's' : ''} overdue for service (-${penalty})`);
  }

  if (input.saltCellDays != null && input.saltCellDays >= 180) {
    score -= 8;
    reasons.push('Salt cell cleaning overdue (-8)');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const band = bandFor(score);
  return { score, band, reasons, ...BAND_META[band] };
}
