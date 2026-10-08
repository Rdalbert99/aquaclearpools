/**
 * Ideal Pool Chemistry — shared, pool-specific rules.
 * Used by the customer page chart, the Chemical Calculator chart and the
 * CYA/Calcium dosing panel so targets can never disagree.
 *
 * All values are OPERATIONAL targets for residential outdoor pools.
 * They are NOT legal minimums — public/commercial pools must follow the
 * local health code (e.g. state/MAHC minimum free chlorine).
 * Pool volume changes dose amounts only, never ppm targets.
 */
import { CHEMICAL_RANGES } from './pool-chemistry';
import {
  defaultCalciumTarget, defaultCyaTarget, detectSurface, isSaltPool,
  type PoolSurface, type Target,
} from './cya-calcium-dosing';

export type ChemKey =
  | 'fc' | 'cc' | 'ph' | 'ta' | 'ch' | 'cya' | 'salt'
  | 'phosphates' | 'metals' | 'borates';

export type Sanitizer = 'salt' | 'chlorine' | 'unknown';
export type RowStatus = 'low' | 'in_range' | 'high' | 'unknown';

export interface TargetOverride { min?: number | null; max?: number | null; target?: number | null }
export type ChemistryOverrides = Partial<Record<ChemKey, TargetOverride>> & { salt_source?: string | null };

export interface PoolProfile {
  sanitizer: Sanitizer;
  surface: PoolSurface;
  /** True when sanitizer/surface came from the customer record (not chosen manually). */
  fromCustomer: boolean;
  overrides?: ChemistryOverrides | null;
}

export type LatestReadings = Partial<Record<ChemKey, number | null | undefined>>;

export interface ChartRow {
  key: ChemKey;
  name: string;
  unit: string;
  /** null when the target depends on something unknown (e.g. FC without CYA). */
  range: Target | null;
  rangeLabel: string;
  targetLabel: string;
  latest: number | null;
  status: RowStatus;
  statusLabel: string;
  isCustom: boolean;
  basis: string;
  notes: string[];
}

/** Build a profile from stored customer text fields. Never guesses: unknown stays unknown. */
export function profileFromClient(c: {
  pool_type?: string | null; liner_type?: string | null; chemistry_targets?: unknown;
}): PoolProfile {
  const t = `${c.pool_type ?? ''} ${c.liner_type ?? ''}`.toLowerCase();
  const sanitizer: Sanitizer = isSaltPool(t) ? 'salt'
    : /chlor|tablet|trichlor|liquid|manual|bleach/.test(t) ? 'chlorine' : 'unknown';
  return {
    sanitizer,
    surface: detectSurface(c.liner_type, c.pool_type),
    fromCustomer: true,
    overrides: sanitizeOverrides(c.chemistry_targets),
  };
}

export function sanitizeOverrides(raw: unknown): ChemistryOverrides | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: ChemistryOverrides = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k === 'salt_source') { if (typeof v === 'string' && v.trim()) out.salt_source = v.trim(); continue; }
    if (!v || typeof v !== 'object') continue;
    const o: TargetOverride = {};
    for (const f of ['min', 'max', 'target'] as const) {
      const n = Number((v as Record<string, unknown>)[f]);
      if ((v as Record<string, unknown>)[f] != null && Number.isFinite(n) && n >= 0) o[f] = n;
    }
    if (Object.keys(o).length) (out as Record<string, TargetOverride>)[k] = o;
  }
  return Object.keys(out).length ? out : null;
}

function merge(base: Target, o?: TargetOverride): { t: Target; custom: boolean } {
  if (!o) return { t: base, custom: false };
  const min = o.min ?? base.min;
  const max = o.max ?? base.max;
  const target = o.target ?? base.target;
  if (min > max) return { t: base, custom: false }; // ignore inconsistent override
  return { t: { min, max, target: Math.min(max, Math.max(min, target)) }, custom: true };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** CYA range for this pool, honoring overrides. Unknown sanitizer → manual-chlorine range. */
export function cyaTargetFor(p: PoolProfile): { t: Target; custom: boolean } {
  return merge(defaultCyaTarget(p.sanitizer === 'salt'), p.overrides?.cya);
}

export function calciumTargetFor(p: PoolProfile): { t: Target; custom: boolean } {
  return merge(defaultCalciumTarget(p.surface), p.overrides?.ch);
}

/**
 * CYA-dependent free chlorine: minimum ≈ 7.5% of CYA, target ≈ 11.5% of CYA
 * (salt pools may run slightly lower; the same minimum is kept for safety),
 * never below 1 ppm. Shock-level is ~40% of CYA. Returns null without a CYA value.
 */
export function fcTargetForCya(cya: number | null | undefined): Target | null {
  if (cya == null || !Number.isFinite(cya) || cya < 0) return null;
  const min = Math.max(1, r1(cya * 0.075));
  const target = Math.max(min, r1(cya * 0.115));
  const max = Math.max(target + 1, r1(cya * 0.2));
  return { min, max, target };
}

function statusOf(v: number | null, range: Target | null, maxOnly = false): RowStatus {
  if (v == null || !range) return 'unknown';
  if (!maxOnly && v < range.min) return 'low';
  if (v > range.max) return 'high';
  return 'in_range';
}

export const STATUS_LABEL: Record<RowStatus, string> = {
  low: 'Low', in_range: 'In range', high: 'High', unknown: 'Unknown',
};

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

/** Build the chart rows for a pool profile + latest readings. */
export function buildIdealChart(p: PoolProfile, latest: LatestReadings = {}): ChartRow[] {
  const o = p.overrides ?? {};
  const rows: ChartRow[] = [];
  const fmt = (t: Target, unit: string) => `${t.min}–${t.max}${unit ? ' ' + unit : ''}`;
  const push = (key: ChemKey, name: string, unit: string, range: Target | null, custom: boolean,
    basis: string, notes: string[], opts: { maxOnly?: boolean; rangeLabel?: string; targetLabel?: string } = {}) => {
    const v = num(latest[key]);
    const status = statusOf(v, range, opts.maxOnly);
    rows.push({
      key, name, unit, range, latest: v, status, statusLabel: STATUS_LABEL[status], isCustom: custom, basis, notes,
      rangeLabel: opts.rangeLabel ?? (range ? fmt(range, unit) : '—'),
      targetLabel: opts.targetLabel ?? (range ? `${range.target}${unit ? ' ' + unit : ''}` : '—'),
    });
  };

  // CYA first (FC depends on it)
  const cya = cyaTargetFor(p);
  const cyaForFc = num(latest.cya) ?? (o.cya?.target ?? null);
  // Free chlorine
  const fcAuto = fcTargetForCya(cyaForFc);
  const fcMerged = o.fc ? merge(fcAuto ?? { min: 1, max: 5, target: 3 }, o.fc) : { t: fcAuto, custom: false };
  push('fc', 'Free Chlorine (FC)', 'ppm', fcMerged.t, fcMerged.custom,
    fcMerged.custom ? 'Custom target for this pool' : fcAuto ? `Based on CYA ${cyaForFc} ppm (min ≈ 7.5% of CYA)` : 'Needs a CYA reading',
    [
      fcAuto ? 'Higher CYA needs higher FC — recheck when CYA changes.' : 'Test CYA first: the safe FC level depends on it, so no single value is shown.',
      'Operational target, not a legal minimum. Commercial/public pools must also meet the health-code minimum.',
    ]);
  // Combined chlorine
  push('cc', 'Combined Chlorine (CC)', 'ppm', merge({ min: 0, max: 0.5, target: 0 }, o.cc).t, !!o.cc,
    'Max 0.5 ppm', ['Above 0.5 ppm: shock / superchlorinate.'], { maxOnly: true, rangeLabel: '≤ 0.5 ppm', targetLabel: '0 ppm' });
  // pH
  const ph = merge({ min: CHEMICAL_RANGES.ph.min, max: CHEMICAL_RANGES.ph.max, target: 7.4 }, o.ph);
  push('ph', 'pH', '', ph.t, ph.custom, 'Standard residential range', []);
  // Total alkalinity
  const taBase = p.sanitizer === 'salt' ? { min: 60, max: 90, target: 70 } : { min: CHEMICAL_RANGES.alkalinity.min, max: CHEMICAL_RANGES.alkalinity.max, target: 100 };
  const ta = merge(taBase, o.ta);
  push('ta', 'Total Alkalinity (TA)', 'ppm', ta.t, ta.custom,
    p.sanitizer === 'salt' ? 'Salt pools run lower TA (salt cells push pH up)' : 'Standard residential range', []);
  // Calcium hardness — surface-specific, tied to CSI/LSI
  const ch = calciumTargetFor(p);
  const chNotes = ['Balance with pH, TA and temperature (CSI/LSI between −0.3 and +0.3) — calcium alone does not decide scaling or etching.'];
  if (p.surface === 'plaster') chNotes.push('Plaster/gunite: low calcium with low CSI can etch the surface.');
  if (p.surface === 'vinyl' || p.surface === 'fiberglass') chNotes.push('Vinyl/fiberglass: no plaster to protect; keep CSI from going high (scale).');
  if (p.surface === 'unknown') chNotes.unshift('Surface unknown — showing a conservative range. Set the surface for an accurate target.');
  push('ch', 'Calcium Hardness (CH)', 'ppm', ch.t, ch.custom,
    ch.custom ? 'Custom target for this pool' : `For ${p.surface === 'unknown' ? 'unknown surface' : p.surface} pools`, chNotes);
  // CYA
  push('cya', 'Cyanuric Acid (CYA)', 'ppm', cya.t, cya.custom,
    cya.custom ? 'Custom target for this pool' : p.sanitizer === 'salt' ? 'Salt pool (outdoor)' : p.sanitizer === 'chlorine' ? 'Manually chlorinated (outdoor)' : 'Sanitizer type unknown — manual-chlorine range',
    ['Raising CYA raises the FC you need.']);
  // Salt — only for salt pools
  if (p.sanitizer === 'salt') {
    const salt = merge({ min: CHEMICAL_RANGES.salt.min, max: CHEMICAL_RANGES.salt.max, target: 3200 }, o.salt);
    const src = o.salt_source;
    push('salt', 'Salt', 'ppm', salt.t, salt.custom,
      salt.custom ? `Manufacturer target${src ? ` (${src})` : ''}` : 'General guidance — not manufacturer-specific',
      salt.custom ? [] : ['Check the salt cell label/manual and save its target as a custom value.']);
  }
  // Optional — shown only when relevant (a reading or a custom target exists)
  const optional: [ChemKey, string, string, Target, boolean, string][] = [
    ['phosphates', 'Phosphates', 'ppb', { min: 0, max: 500, target: 0 }, true, 'Usually only matters with recurring algae'],
    ['metals', 'Metals (copper/iron)', 'ppm', { min: 0, max: 0.2, target: 0 }, true, 'Stains; watch on well water'],
    ['borates', 'Borates', 'ppm', { min: 30, max: 50, target: 50 }, false, 'Only if borates are used'],
  ];
  for (const [key, name, unit, base, maxOnly, basis] of optional) {
    if (num(latest[key]) == null && !o[key]) continue;
    const m = merge(base, o[key]);
    push(key, name, unit, m.t, m.custom, basis, [], maxOnly ? { maxOnly, rangeLabel: `≤ ${m.t.max} ${unit}` } : {});
  }
  return rows;
}

/** Pull latest readings from a service row (readings JSON first, then columns). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function latestFromService(svc: any): LatestReadings {
  if (!svc) return {};
  const r = svc.readings ?? {};
  return {
    fc: r.fc ?? svc.chlorine_level ?? null,
    cc: r.cc ?? null,
    ph: r.ph ?? svc.ph_level ?? null,
    ta: r.ta ?? svc.alkalinity_level ?? null,
    ch: r.ch ?? r.calcium ?? svc.calcium_hardness_level ?? null,
    cya: r.cya ?? svc.cyanuric_acid_level ?? null,
    salt: r.salt ?? svc.salt_level ?? null,
    phosphates: r.phosphates ?? null,
    metals: r.metals ?? null,
    borates: r.borates ?? null,
  };
}
