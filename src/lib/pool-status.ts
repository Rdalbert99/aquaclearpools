// Helpers for computing pool service & balance status from client schedule and readings.

import { CHEMICAL_RANGES, isInRange, type ChemicalId } from './pool-chemistry';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function normalizeDay(d: string): number {
  const lower = d.toLowerCase().slice(0, 3);
  const idx = DAY_NAMES.findIndex(n => n.toLowerCase().startsWith(lower));
  return idx;
}

/** Most recent scheduled service date on or before today (returns null if no days set). */
export function getPreviousDueDate(serviceDays: string[] | null | undefined, now = new Date()): Date | null {
  if (!serviceDays || serviceDays.length === 0) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayDow = today.getDay();
  const dows = serviceDays.map(normalizeDay).filter(i => i >= 0);
  if (!dows.length) return null;

  let bestOffset = Infinity;
  for (const dow of dows) {
    // days since most recent occurrence of this DOW (0 = today)
    const offset = (todayDow - dow + 7) % 7;
    if (offset < bestOffset) bestOffset = offset;
  }
  const due = new Date(today);
  due.setDate(today.getDate() - bestOffset);
  return due;
}

/** Next scheduled service date strictly after today. */
export function getNextDueDate(serviceDays: string[] | null | undefined, now = new Date()): Date | null {
  if (!serviceDays || serviceDays.length === 0) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayDow = today.getDay();
  const dows = serviceDays.map(normalizeDay).filter(i => i >= 0);
  if (!dows.length) return null;

  let bestOffset = Infinity;
  for (const dow of dows) {
    const offset = ((dow - todayDow + 7) % 7) || 7; // strictly after today
    if (offset < bestOffset) bestOffset = offset;
  }
  const next = new Date(today);
  next.setDate(today.getDate() + bestOffset);
  return next;
}

/**
 * Pool service status:
 * - 'current'        if last completed service is on/after the most recent scheduled day
 * - 'needs_service'  if no service has happened on/after that day
 * Falls back to next_service_date or a 7-day rule when no service_days set.
 */
export function getPoolServiceStatus(
  serviceDays: string[] | null | undefined,
  lastServiceDate: string | Date | null | undefined,
  nextServiceDate?: string | Date | null,
  now = new Date(),
): 'current' | 'needs_service' {
  const lastServed = lastServiceDate ? new Date(lastServiceDate) : null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const prevDue = getPreviousDueDate(serviceDays, now);
  if (prevDue) {
    if (!lastServed) return 'needs_service';
    const served = new Date(lastServed.getFullYear(), lastServed.getMonth(), lastServed.getDate());
    return served >= prevDue ? 'current' : 'needs_service';
  }

  if (nextServiceDate) {
    const next = new Date(nextServiceDate);
    if (today < next) return 'current';
    if (!lastServed) return 'needs_service';
    return lastServed >= next ? 'current' : 'needs_service';
  }

  // Fallback: 7-day rule
  if (!lastServed) return 'needs_service';
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  return lastServed >= weekAgo ? 'current' : 'needs_service';
}

// ---- Balance status ----------------------------------------------------------

const READING_TO_CHEMICAL: Record<ChemicalId, { low: RegExp[]; high: RegExp[] }> = {
  ph:         {
    low:  [/soda\s*ash/i, /sodium\s*carbonate/i, /ph\s*(up|plus|increaser|raiser)/i, /borax/i],
    high: [/muriatic/i, /sodium\s*bisulfate/i, /dry\s*acid/i, /\bacid\b/i, /ph\s*(down|minus|decreaser|reducer)/i],
  },
  alkalinity: {
    low:  [/sodium\s*bicarb/i, /baking\s*soda/i, /alkalinity\s*(up|increaser)/i],
    high: [/muriatic/i, /sodium\s*bisulfate/i, /dry\s*acid/i, /\bacid\b/i],
  },
  chlorine:   {
    low:  [/chlorine/i, /cal[-\s]?hypo/i, /hypochlorite/i, /trichlor/i, /dichlor/i, /\btabs?\b/i, /shock/i, /bleach/i],
    high: [/thiosulfate/i, /chlorine\s*(neutralizer|reducer)/i],
  },
  cya:        { low: [/cya/i, /cyanuric/i, /stabilizer/i, /conditioner/i], high: [] },
  salt:       { low: [/salt/i], high: [] },
};

export interface BalanceStatus {
  inBalance: boolean;
  outOfRange: { chemId: ChemicalId; value: number; addressed: boolean }[];
}

/** Combine any text sources (chemicals added, notes, actions, services performed) into one searchable blob. */
function toSearchText(source: unknown): string {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  if (Array.isArray(source)) return source.map(toSearchText).join(' ');
  if (typeof source === 'object') return Object.values(source as Record<string, unknown>).map(toSearchText).join(' ');
  return String(source);
}

/**
 * Determine if the pool is in balance given latest readings and what the tech added.
 * Any reading that was treated with the appropriate chemical counts as handled,
 * so the pool reads balanced once the tech has dosed for every out-of-range value.
 */
export function getBalanceStatus(
  readings: Partial<Record<ChemicalId, number | null | undefined>>,
  chemicalsAddedText: unknown,
  ...extraSources: unknown[]
): BalanceStatus {
  const text = [chemicalsAddedText, ...extraSources].map(toSearchText).join('\n').toLowerCase();
  const out: BalanceStatus['outOfRange'] = [];

  (Object.keys(CHEMICAL_RANGES) as ChemicalId[]).forEach(chemId => {
    const value = readings[chemId];
    if (value == null || isNaN(value as number)) return;
    if (isInRange(chemId, value as number) === 'in') return;

    const range = CHEMICAL_RANGES[chemId];
    const isLow = (value as number) < range.min;
    const patterns = isLow ? READING_TO_CHEMICAL[chemId].low : READING_TO_CHEMICAL[chemId].high;
    const addressed = patterns.some(p => p.test(text));
    out.push({ chemId, value: value as number, addressed });
  });

  const inBalance = out.length === 0 || out.every(r => r.addressed);
  return { inBalance, outOfRange: out };
}


/** List dosage instructions for any out-of-range readings that the tech did not address. */
export function getMissingFixes(
  readings: Partial<Record<ChemicalId, number | null | undefined>>,
  chemicalsAddedText: string | null | undefined,
  poolGallons: number,
): string[] {
  const { outOfRange } = getBalanceStatus(readings, chemicalsAddedText);
  // Import lazily to avoid cycle
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getDosageInstruction } = require('./pool-chemistry') as typeof import('./pool-chemistry');
  return outOfRange
    .filter(r => !r.addressed)
    .map(r => getDosageInstruction(r.chemId, r.value, poolGallons))
    .filter(Boolean) as string[];
}
