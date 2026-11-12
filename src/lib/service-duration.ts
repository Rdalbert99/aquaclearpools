/** Prefer the current field, preserving explicit zero; never invent time. */
export interface DurationRecord { duration_minutes?: number | null; duration?: number | null; started_at?: string | null; completed_at?: string | null }
export function serviceMinutes(s: DurationRecord): number | null {
  for (const value of [s.duration_minutes, s.duration]) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}
export function durationLabel(s: DurationRecord): string {
  const n = serviceMinutes(s);
  return n === null ? 'Not recorded' : `${n} min`;
}
export function timeSource(s: DurationRecord): 'Timed' | 'Recorded / manual' | 'Not recorded' {
  if (serviceMinutes(s) === null) return 'Not recorded';
  const start = Date.parse(s.started_at || ''), end = Date.parse(s.completed_at || '');
  const expected = Math.max(1, Math.round((end - start) / 60000));
  return Number.isFinite(start) && Number.isFinite(end) && end >= start && s.duration_minutes === expected ? 'Timed' : 'Recorded / manual';
}
