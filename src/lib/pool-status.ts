// Helpers for computing pool service & balance status from client schedule and readings.

import { CHEMICAL_RANGES, isInRange, getDosageInstruction, type ChemicalId } from './pool-chemistry';

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

/** Human-friendly names for the chemicals we look for in service records. */
const PATTERN_LABELS: { re: RegExp; label: string }[] = [
  { re: /soda\s*ash|sodium\s*carbonate|ph\s*(up|plus|increaser|raiser)|borax/i, label: 'soda ash / pH up' },
  { re: /muriatic/i, label: 'muriatic acid' },
  { re: /sodium\s*bisulfate|dry\s*acid|ph\s*(down|minus|decreaser|reducer)|\bacid\b/i, label: 'acid / pH down' },
  { re: /sodium\s*bicarb|baking\s*soda|alkalinity\s*(up|increaser)/i, label: 'sodium bicarbonate' },
  { re: /cal[-\s]?hypo|hypochlorite|trichlor|dichlor|\btabs?\b|shock|bleach|chlorine/i, label: 'chlorine' },
  { re: /thiosulfate|chlorine\s*(neutralizer|reducer)/i, label: 'chlorine neutralizer' },
  { re: /cya|cyanuric|stabilizer|conditioner/i, label: 'stabilizer (CYA)' },
  { re: /salt/i, label: 'salt' },
];

/** Per-chemical tolerance allowed for test-kit accuracy (in the reading's own unit). */
export type BalanceTolerances = Record<ChemicalId, number>;

export const DEFAULT_TOLERANCES: BalanceTolerances = {
  ph: 0.2,
  alkalinity: 10,
  chlorine: 0.5,
  cya: 5,
  salt: 200,
};

const TOLERANCE_STORAGE_KEY = 'acp.balance-tolerances';

/** Read the saved tolerances (falls back to defaults). Safe on the server. */
export function getBalanceTolerances(): BalanceTolerances {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(TOLERANCE_STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULT_TOLERANCES };
    const parsed = JSON.parse(raw) as Partial<BalanceTolerances>;
    const merged = { ...DEFAULT_TOLERANCES };
    (Object.keys(DEFAULT_TOLERANCES) as ChemicalId[]).forEach(id => {
      const v = parsed?.[id];
      if (typeof v === 'number' && isFinite(v) && v >= 0) merged[id] = v;
    });
    return merged;
  } catch {
    return { ...DEFAULT_TOLERANCES };
  }
}

/** Persist tolerances used by the balance calculation. */
export function setBalanceTolerances(tolerances: Partial<BalanceTolerances>): BalanceTolerances {
  const merged = { ...getBalanceTolerances(), ...tolerances };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TOLERANCE_STORAGE_KEY, JSON.stringify(merged));
    }
  } catch {
    /* ignore storage failures */
  }
  return merged;
}

/** A named service-record field we search for dose evidence. */
export interface BalanceSource {
  label: string;
  value: unknown;
}

export interface BalanceReadingDetail {
  chemId: ChemicalId;
  label: string;
  unit: string;
  value: number;
  /** Ideal range before tolerance. */
  idealMin: number;
  idealMax: number;
  /** Range actually enforced (ideal ± tolerance). */
  toleranceApplied: number;
  effectiveMin: number;
  effectiveMax: number;
  direction: 'low' | 'high';
  /** How far outside the ideal range the reading sits. */
  deviation: number;
  /** True when the reading is outside the ideal range but inside tolerance. */
  withinTolerance: boolean;
  /** True when a matching dose was found in a service record. */
  addressed: boolean;
  /** Which record field matched, e.g. "Chemicals added". */
  matchedSource?: string;
  /** Which chemical matched, e.g. "muriatic acid". */
  matchedChemical?: string;
  /** The exact text snippet that matched. */
  matchedText?: string;
  /** Plain-English explanation of this reading's outcome. */
  explanation: string;
  /** Set when unresolved: what dose/record we looked for and did not find. */
  missingReason?: string;
  /** Chemicals we searched for when nothing matched. */
  expectedChemicals?: string[];
}

export interface BalanceStatus {
  inBalance: boolean;
  /** Readings outside the ideal range (including ones excused by tolerance or a dose). */
  outOfRange: BalanceReadingDetail[];
  /** Readings inside the ideal range. */
  inRange: BalanceReadingDetail[];
  /** Readings that keep the pool out of balance. */
  unresolved: BalanceReadingDetail[];
  /** Record fields that were searched for dose evidence. */
  searchedSources: string[];
  tolerances: BalanceTolerances;
  /** One-line summary of the verdict. */
  summary: string;
}

/** Combine any text sources (chemicals added, notes, actions, services performed) into one searchable blob. */
function toSearchText(source: unknown): string {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  if (Array.isArray(source)) return source.map(toSearchText).join(' ');
  if (typeof source === 'object') return Object.values(source as Record<string, unknown>).map(toSearchText).join(' ');
  return String(source);
}

function isBalanceSource(v: unknown): v is BalanceSource {
  return !!v && typeof v === 'object' && !Array.isArray(v) && typeof (v as BalanceSource).label === 'string' && 'value' in (v as object);
}

function snippet(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 25);
  const end = Math.min(text.length, index + length + 25);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

function labelFor(pattern: RegExp): string {
  const found = PATTERN_LABELS.find(p => p.re.source === pattern.source);
  if (found) return found.label;
  const alt = PATTERN_LABELS.find(p => p.re.test(pattern.source.replace(/\\s\*|\\b|[\\()|?]/g, ' ')));
  return alt ? alt.label : 'matching chemical';
}

function expectedNamesFor(patterns: RegExp[]): string[] {
  const names = patterns.map(labelFor);
  return Array.from(new Set(names));
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export interface BalanceOptions {
  tolerances?: Partial<BalanceTolerances>;
}

/**
 * Determine if the pool is in balance given latest readings and what the tech added.
 * A reading counts as handled when it is inside the ideal range, inside the configured
 * test-kit tolerance, or a matching chemical dose is found in the service records.
 *
 * Sources may be raw values or `{ label, value }` pairs so the explanation can name the
 * record field that matched. An optional trailing `{ tolerances }` object overrides the
 * saved tolerance settings.
 */
export function getBalanceStatus(
  readings: Partial<Record<ChemicalId, number | null | undefined>>,
  ...sources: (unknown | BalanceSource | BalanceOptions)[]
): BalanceStatus {
  let options: BalanceOptions = {};
  const rest = [...sources];
  const last = rest[rest.length - 1];
  if (last && typeof last === 'object' && !Array.isArray(last) && 'tolerances' in (last as object)) {
    options = rest.pop() as BalanceOptions;
  }

  const tolerances: BalanceTolerances = { ...getBalanceTolerances(), ...(options.tolerances ?? {}) };

  const named: BalanceSource[] = rest.map((s, i) =>
    isBalanceSource(s) ? s : { label: `Service record ${i + 1}`, value: s },
  ).filter(s => toSearchText(s.value).trim().length > 0);

  const searchedSources = named.map(s => s.label);

  const outOfRange: BalanceReadingDetail[] = [];
  const inRange: BalanceReadingDetail[] = [];

  (Object.keys(CHEMICAL_RANGES) as ChemicalId[]).forEach(chemId => {
    const raw = readings[chemId];
    if (raw == null || isNaN(raw as number)) return;
    const value = raw as number;
    const range = CHEMICAL_RANGES[chemId];
    const tol = tolerances[chemId] ?? 0;

    const base: Omit<BalanceReadingDetail, 'direction' | 'deviation' | 'withinTolerance' | 'addressed' | 'explanation'> = {
      chemId,
      label: range.label,
      unit: range.unit,
      value,
      idealMin: range.min,
      idealMax: range.max,
      toleranceApplied: tol,
      effectiveMin: range.min - tol,
      effectiveMax: range.max + tol,
    };

    if (isInRange(chemId, value) === 'in') {
      inRange.push({
        ...base,
        direction: value < range.min ? 'low' : 'high',
        deviation: 0,
        withinTolerance: false,
        addressed: true,
        explanation: `${range.label} ${fmt(value)}${range.unit ? ' ' + range.unit : ''} is inside the ideal range ${fmt(range.min)}–${fmt(range.max)}.`,
      });
      return;
    }

    const isLow = value < range.min;
    const deviation = isLow ? range.min - value : value - range.max;
    const withinTolerance = value >= base.effectiveMin && value <= base.effectiveMax;

    const patterns = isLow ? READING_TO_CHEMICAL[chemId].low : READING_TO_CHEMICAL[chemId].high;

    let matchedSource: string | undefined;
    let matchedChemical: string | undefined;
    let matchedText: string | undefined;

    for (const source of named) {
      const text = toSearchText(source.value);
      for (const pattern of patterns) {
        const m = pattern.exec(text);
        if (m) {
          matchedSource = source.label;
          matchedChemical = labelFor(pattern);
          matchedText = snippet(text, m.index, m[0].length);
          break;
        }
      }
      if (matchedSource) break;
    }

    const dosed = !!matchedSource;
    const addressed = dosed || withinTolerance;
    const reading = `${range.label} ${fmt(value)}${range.unit ? ' ' + range.unit : ''}`;
    const dir = isLow ? 'below' : 'above';
    const bound = isLow ? range.min : range.max;

    let explanation: string;
    let missingReason: string | undefined;

    if (dosed) {
      explanation = `${reading} is ${fmt(deviation)} ${dir} the ideal ${fmt(bound)}, but "${matchedChemical}" was logged in ${matchedSource} — counted as treated.`;
    } else if (withinTolerance) {
      explanation = `${reading} is ${fmt(deviation)} ${dir} the ideal ${fmt(bound)}, which is inside the ±${fmt(tol)} test-kit tolerance — counted as balanced.`;
    } else {
      const expected = expectedNamesFor(patterns);
      explanation = `${reading} is ${fmt(deviation)} ${dir} the ideal ${fmt(bound)} (tolerance ±${fmt(tol)}) and no matching dose was found.`;
      missingReason = expected.length
        ? `No ${expected.join(' / ')} dose found in ${searchedSources.length ? searchedSources.join(', ') : 'any service record'}.`
        : `No corrective product is tracked for high ${range.label}; a manual adjustment (dilution/drain) is needed.`;
      outOfRange.push({
        ...base,
        direction: isLow ? 'low' : 'high',
        deviation,
        withinTolerance,
        addressed,
        explanation,
        missingReason,
        expectedChemicals: expected,
      });
      return;
    }

    outOfRange.push({
      ...base,
      direction: isLow ? 'low' : 'high',
      deviation,
      withinTolerance,
      addressed,
      matchedSource,
      matchedChemical,
      matchedText,
      explanation,
    });
  });

  const unresolved = outOfRange.filter(r => !r.addressed);
  const inBalance = unresolved.length === 0;
  const summary = inBalance
    ? outOfRange.length === 0
      ? 'All recorded readings are inside their ideal ranges.'
      : `${outOfRange.length} reading${outOfRange.length === 1 ? ' was' : 's were'} outside the ideal range but ${outOfRange.length === 1 ? 'was' : 'were'} treated or within tolerance.`
    : `${unresolved.length} reading${unresolved.length === 1 ? '' : 's'} still need${unresolved.length === 1 ? 's' : ''} treatment: ${unresolved.map(r => r.label).join(', ')}.`;

  return { inBalance, outOfRange, inRange, unresolved, searchedSources, tolerances, summary };
}

/** List dosage instructions for any out-of-range readings that the tech did not address. */
export function getMissingFixes(
  readings: Partial<Record<ChemicalId, number | null | undefined>>,
  chemicalsAddedText: string | null | undefined,
  poolGallons: number,
): string[] {
  const { unresolved } = getBalanceStatus(readings, { label: 'Chemicals added', value: chemicalsAddedText });
  return unresolved
    .map(r => getDosageInstruction(r.chemId, r.value, poolGallons))
    .filter(Boolean) as string[];
}

