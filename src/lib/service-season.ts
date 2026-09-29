/**
 * In-Season / Off-Season scheduling. Scheduling only — never touches billing.
 * Customers without an off-season configuration behave exactly as before (weekly).
 */
export type ServiceMode = 'in_season' | 'off_season';

export interface SeasonFields {
  service_mode?: string | null;
  in_season_frequency?: string | null;
  off_season_frequency?: string | null;
  off_season_weeks?: string | null;
  off_season_start?: string | null;
  off_season_end?: string | null;
  auto_return_in_season?: boolean | null;
}

export const IN_SEASON_FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every other week' },
];

export const OFF_SEASON_FREQUENCIES = [
  { value: 'twice_monthly', label: 'Twice Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every other week' },
  { value: 'monthly', label: 'Monthly (1st week)' },
  { value: 'none', label: 'No service (paused)' },
];

export const OFF_SEASON_WEEK_OPTIONS = [
  { value: '1_3', label: '1st & 3rd week' },
  { value: '2_4', label: '2nd & 4th week' },
];

const dayOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const parseDate = (s?: string | null) => {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return y ? new Date(y, (m || 1) - 1, d || 1) : null;
};

/** Which mode applies on the given date, accounting for off-season dates and auto-return. */
export function effectiveServiceMode(c: SeasonFields, date = new Date()): ServiceMode {
  const d = dayOnly(date);
  const start = parseDate(c.off_season_start);
  const end = parseDate(c.off_season_end);
  const manual: ServiceMode = c.service_mode === 'off_season' ? 'off_season' : 'in_season';
  if (start && end) {
    if (d >= start && d <= end) return 'off_season';
    if (d > end) return c.auto_return_in_season === false ? manual : 'in_season';
    return manual;
  }
  if (start && !end) return d >= start ? 'off_season' : manual;
  if (end && d > end && c.auto_return_in_season !== false) return 'in_season';
  return manual;
}

/** 1-based week of month: days 1–7 → 1, 8–14 → 2, etc. */
export const weekOfMonth = (d: Date) => Math.ceil(d.getDate() / 7);

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function frequencyMatches(freq: string, weeks: string, d: Date): boolean {
  switch (freq) {
    case 'none': return false;
    case 'monthly': return weekOfMonth(d) === 1;
    case 'biweekly': return isoWeek(d) % 2 === 0;
    case 'twice_monthly': {
      const w = weekOfMonth(d);
      return weeks === '2_4' ? w === 2 || w === 4 : w === 1 || w === 3;
    }
    default: return true; // weekly
  }
}

/** True if the customer's active mode + frequency schedules service during the week containing `date`. */
export function isServiceWeek(c: SeasonFields, date = new Date()): boolean {
  const mode = effectiveServiceMode(c, date);
  if (mode === 'off_season') {
    return frequencyMatches(c.off_season_frequency || 'twice_monthly', c.off_season_weeks || '1_3', date);
  }
  return frequencyMatches(c.in_season_frequency || 'weekly', '1_3', date);
}

/** Days between visits for "already serviced" windows. */
export function scheduleCycleDays(c: SeasonFields, date = new Date()): number {
  const mode = effectiveServiceMode(c, date);
  const f = mode === 'off_season' ? c.off_season_frequency || 'twice_monthly' : c.in_season_frequency || 'weekly';
  return f === 'twice_monthly' || f === 'biweekly' ? 14 : f === 'monthly' ? 28 : 7;
}

export function seasonLabel(c: SeasonFields, date = new Date()): string | null {
  if (effectiveServiceMode(c, date) !== 'off_season') return null;
  const f = OFF_SEASON_FREQUENCIES.find((o) => o.value === (c.off_season_frequency || 'twice_monthly'))?.label ?? 'Off-season';
  const w = (c.off_season_frequency || 'twice_monthly') === 'twice_monthly'
    ? ` (${OFF_SEASON_WEEK_OPTIONS.find((o) => o.value === (c.off_season_weeks || '1_3'))?.label})` : '';
  return `Off-season · ${f}${w}`;
}
