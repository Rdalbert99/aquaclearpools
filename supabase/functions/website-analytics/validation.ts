export const events = ['page_view', 'call_click', 'text_click'] as const;
export const referrals = ['direct', 'search', 'social', 'referral', 'internal'] as const;
export function validEvent(value: unknown): value is { event: string; referral: string; page: '/' } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 3 && v.page === '/' && events.some(e => e === v.event) && referrals.some(r => r === v.referral);
}
export function validReport(value: unknown): value is { action: 'report'; days: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 2 && v.action === 'report' && [7, 30, 90].includes(v.days as number);
}