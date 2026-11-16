/**
 * In-Season / Off-Season scheduling. Scheduling only — never touches billing.
 * Seasonal Schedule is authoritative for recurring route dates.
 */
export type ServiceMode = 'in_season' | 'off_season';

export interface SeasonFields {
  status?: string | null;
  service_frequency?: string | null;
  biweekly_anchor_date?: string | null;
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
  const day = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
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

const DAY_MS = 86_400_000;
function weekStartIndex(day: Date): number {
  return Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) / DAY_MS - ((day.getDay() + 6) % 7);
}

function frequencyMatches(freq: string, weeks: string, d: Date, anchor?: Date | null): boolean {
  switch (freq) {
    case 'none': return false;
    case 'monthly': return weekOfMonth(d) === 1;
    case 'biweekly': return !!anchor && (weekStartIndex(d) - weekStartIndex(anchor)) % 14 === 0;
    case 'twice_monthly': {
      const w = weekOfMonth(d);
      return weeks === '2_4' ? w === 2 || w === 4 : w === 1 || w === 3;
    }
    default: return true; // weekly
  }
}

export function isActiveServiceAccount(c: SeasonFields): boolean {
  // Preserve existing behavior for legacy rows with no status, not explicit non-active statuses.
  const status = c.status?.trim().toLowerCase();
  return !status || status === 'active';
}

function frequencyFor(c: SeasonFields, date: Date): string {
  return effectiveServiceMode(c, date) === 'off_season'
    ? c.off_season_frequency || 'twice_monthly'
    : c.in_season_frequency || 'weekly';
}

export function recurringScheduleIssue(c: SeasonFields, date = new Date()): 'inactive' | 'paused' | 'confirm_rotation' | null {
  if (!isActiveServiceAccount(c)) return 'inactive';
  const freq = frequencyFor(c, date);
  if (freq === 'none') return 'paused';
  if (freq === 'biweekly' && !parseDate(c.biweekly_anchor_date)) return 'confirm_rotation';
  // Basic Service Frequency is not a route anchor. Do not turn a conflicting
  // bi-weekly setting into weekly visits or guess the intended alternate week.
  const legacyFreq = c.service_frequency?.trim().toLowerCase();
  if (effectiveServiceMode(c, date) === 'in_season' && freq === 'weekly' &&
    (legacyFreq === 'bi-weekly' || legacyFreq === 'biweekly')) return 'confirm_rotation';
  return null;
}

/** True if the customer's effective mode and frequency schedule service in the given week. */
export function isServiceWeek(c: SeasonFields, date = new Date()): boolean {
  if (recurringScheduleIssue(c, date)) return false;
  return frequencyMatches(frequencyFor(c, date), c.off_season_weeks || '1_3', date, parseDate(c.biweekly_anchor_date));
}

export interface RouteScheduleFields extends SeasonFields {
  service_days?: string[] | null;
  next_service_date?: string | null;
}

const SHORT_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export function scheduledWeekdays(days: string[] | null | undefined): number[] {
  return [...new Set((days ?? []).map((day) => SHORT_DAYS.indexOf(day.trim().toLowerCase().slice(0, 3))))]
    .filter((index) => index >= 0);
}

export function isRecurringServiceOn(c: RouteScheduleFields, date: Date): boolean {
  return isServiceWeek(c, date) && scheduledWeekdays(c.service_days).includes(date.getDay());
}

/** The raw profile next_service_date can be stale. Only recurring rule dates are inferred here. */
export function nextScheduledServiceDate(c: RouteScheduleFields, now = new Date()): Date | null {
  const today = dayOnly(now);
  for (let offset = 1; offset <= 70; offset++) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    if (isRecurringServiceOn(c, date)) return date;
  }
  return null;
}

/** Tech's recurring overdue list includes only an unfulfilled due date earlier this calendar week. */
export function isCurrentWeekVisitOverdue(c: RouteScheduleFields & { last_service_date?: string | null }, now = new Date()): boolean {
  const today = dayOnly(now);
  const monday = new Date(today);
  monday.setDate(today.getDate() - (today.getDay() + 6) % 7);
  const lastService = parseDate(c.last_service_date);
  for (let date = new Date(today); date > monday;) {
    date.setDate(date.getDate() - 1);
    if (isRecurringServiceOn(c, date)) return !lastService || lastService < date;
  }
  return false;
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
