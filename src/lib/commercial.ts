/**
 * Commercial portal domain helpers.
 *
 * The commercial layer is a *view* over the existing Aqua Clear data:
 * pools -> clients -> services -> service_chemical_usage.
 * Nothing here writes to the technician workflow.
 */

export type CommercialStatus = 'normal' | 'monitor' | 'attention_needed' | 'action_required';

export const STATUS_LABEL: Record<CommercialStatus, string> = {
  normal: 'NORMAL',
  monitor: 'MONITOR',
  attention_needed: 'ATTENTION NEEDED',
  action_required: 'ACTION REQUIRED',
};

/** Semantic token classes (no hardcoded palette utilities). */
export const STATUS_CLASS: Record<CommercialStatus, string> = {
  normal: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400',
  monitor: 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-400',
  attention_needed: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400',
  action_required: 'bg-destructive/10 text-destructive border-destructive/30',
};

const STATUS_RANK: Record<CommercialStatus, number> = {
  normal: 0,
  monitor: 1,
  attention_needed: 2,
  action_required: 3,
};

export function worstStatus(...statuses: CommercialStatus[]): CommercialStatus {
  return statuses.reduce<CommercialStatus>(
    (worst, s) => (STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst),
    'normal',
  );
}

export const ISSUE_STATUSES = [
  'new',
  'monitoring',
  'warranty_contacted',
  'service_scheduled',
  'waiting_on_parts',
  'repair_in_progress',
  'completed',
] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  new: 'New',
  monitoring: 'Monitoring',
  warranty_contacted: 'Warranty contacted',
  service_scheduled: 'Service scheduled',
  waiting_on_parts: 'Waiting on parts',
  repair_in_progress: 'Repair in progress',
  completed: 'Completed',
};

/* ------------------------------------------------------------------ */
/* Chemistry                                                           */
/* ------------------------------------------------------------------ */

export interface ChemRange {
  key: string;
  label: string;
  unit: string;
  /** Ideal operating band. */
  ideal: [number, number];
  /** Outside this band the pool needs attention. */
  acceptable: [number, number];
  /** Outside this band the pool is unsafe for bathers. */
  safe: [number, number];
  decimals: number;
}

/** Commercial/public-pool oriented bands (stricter than residential). */
export const CHEM_RANGES: ChemRange[] = [
  { key: 'chlorine', label: 'Free Chlorine', unit: 'ppm', ideal: [2, 4], acceptable: [1, 6], safe: [1, 10], decimals: 1 },
  { key: 'ph', label: 'pH', unit: '', ideal: [7.4, 7.6], acceptable: [7.2, 7.8], safe: [7.0, 8.0], decimals: 1 },
  { key: 'alkalinity', label: 'Total Alkalinity', unit: 'ppm', ideal: [80, 120], acceptable: [60, 180], safe: [40, 240], decimals: 0 },
  { key: 'cyanuric_acid', label: 'Cyanuric Acid', unit: 'ppm', ideal: [30, 50], acceptable: [20, 80], safe: [0, 100], decimals: 0 },
  { key: 'calcium', label: 'Calcium Hardness', unit: 'ppm', ideal: [200, 400], acceptable: [150, 600], safe: [100, 800], decimals: 0 },
  { key: 'salt', label: 'Salt', unit: 'ppm', ideal: [2700, 3400], acceptable: [2400, 4000], safe: [1500, 6000], decimals: 0 },
];

export function chemStatus(range: ChemRange, value: number | null | undefined): CommercialStatus {
  if (value === null || value === undefined || Number.isNaN(value)) return 'normal';
  if (value < range.safe[0] || value > range.safe[1]) return 'action_required';
  if (value < range.acceptable[0] || value > range.acceptable[1]) return 'attention_needed';
  if (value < range.ideal[0] || value > range.ideal[1]) return 'monitor';
  return 'normal';
}

export interface ServiceRow {
  id: string;
  client_id: string | null;
  technician_id: string | null;
  performed_at: string;
  service_date: string;
  status: string | null;
  notes: string | null;
  services_performed: string | null;
  chemicals_added: string | null;
  readings: unknown;
  actions: unknown;
  ph_level: number | null;
  chlorine_level: number | null;
  alkalinity_level: number | null;
  cyanuric_acid_level: number | null;
  calcium_hardness_level: number | null;
  tests_performed: string[] | null;
  before_photo_url: string | null;
  after_photo_url: string | null;
  duration_minutes: number | null;
}

/** Normalizes a service row into { chemKey: value } using columns first, then the readings blob. */
export function readingsFromService(service: ServiceRow): Record<string, number | null> {
  const blob = (service.readings ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    chlorine: service.chlorine_level ?? num(blob.chlorine ?? blob.free_chlorine ?? blob.fc),
    ph: service.ph_level ?? num(blob.ph),
    alkalinity: service.alkalinity_level ?? num(blob.alkalinity ?? blob.ta),
    cyanuric_acid: service.cyanuric_acid_level ?? num(blob.cyanuric_acid ?? blob.cya),
    calcium: service.calcium_hardness_level ?? num(blob.calcium ?? blob.calcium_hardness ?? blob.ch),
    salt: num(blob.salt),
  };
}

/** Overall chemistry status for the most recent visit. */
export function chemistryStatus(service: ServiceRow | null): CommercialStatus {
  if (!service) return 'monitor';
  const readings = readingsFromService(service);
  return worstStatus(
    ...CHEM_RANGES.map((r) => chemStatus(r, readings[r.key])),
  );
}

/* ------------------------------------------------------------------ */
/* Date ranges                                                         */
/* ------------------------------------------------------------------ */

export type RangeKey = '7d' | '30d' | '90d' | '6m' | '1y' | 'custom';

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
  { key: '6m', label: '6 Months' },
  { key: '1y', label: '1 Year' },
  { key: 'custom', label: 'Custom' },
];

export function rangeStart(key: RangeKey, now = new Date()): Date {
  const d = new Date(now);
  switch (key) {
    case '7d': d.setDate(d.getDate() - 7); break;
    case '30d': d.setDate(d.getDate() - 30); break;
    case '90d': d.setDate(d.getDate() - 90); break;
    case '6m': d.setMonth(d.getMonth() - 6); break;
    case '1y': d.setFullYear(d.getFullYear() - 1); break;
    default: d.setDate(d.getDate() - 30);
  }
  return d;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

/** Equipment warranty / status roll-up. */
export function equipmentStatus(warrantyExpiration: string | null, status: CommercialStatus): CommercialStatus {
  if (status !== 'normal') return status;
  if (!warrantyExpiration) return 'normal';
  const expires = new Date(warrantyExpiration).getTime();
  const in60 = Date.now() + 60 * 86_400_000;
  if (expires < Date.now()) return 'monitor';
  if (expires < in60) return 'monitor';
  return 'normal';
}
