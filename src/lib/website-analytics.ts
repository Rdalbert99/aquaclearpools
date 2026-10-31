export type AnalyticsEvent = 'page_view' | 'call_click' | 'text_click';
export type Referral = 'direct' | 'search' | 'social' | 'referral' | 'internal';
export const analyticsEndpoint = 'https://tbqqigqkbogibwumjyol.supabase.co/functions/v1/website-analytics';
const belongs = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);
export function referralCategory(referrer: string): Referral {
  if (!referrer) return 'direct';
  let host: string;
  try { host = new URL(referrer).hostname.toLowerCase(); } catch { return 'direct'; }
  if (belongs(host, 'getaquaclear.com')) return 'internal';
  if (['google.com', 'bing.com', 'duckduckgo.com', 'search.yahoo.com', 'search.brave.com'].some(d => belongs(host, d))) return 'search';
  if (['facebook.com', 'instagram.com', 't.co', 'twitter.com', 'x.com', 'linkedin.com', 'pinterest.com', 'youtube.com', 'tiktok.com'].some(d => belongs(host, d))) return 'social';
  return 'referral';
}
export function trackHomepage(event: AnalyticsEvent, referral: Referral) {
  if (window.location.origin !== 'https://getaquaclear.com' || window.location.pathname !== '/') return;
  // Fixed legacy public anon JWT, never a user token. No retries, storage or credentials.
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key || !key.startsWith('eyJ')) return;
  try {
    void fetch(analyticsEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ event, referral, page: '/' }), credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', redirect: 'error', keepalive: true }).catch(() => {});
  } catch { /* Calling/texting must never wait for tracking. */ }
}

// Microtask coalesces StrictMode's immediate setup/cleanup/setup, not real later visits.
export function installHomepageAnalytics(root: HTMLElement, send = trackHomepage) {
  if (window.location.pathname !== '/') return () => {};
  let active = true;
  const referral = referralCategory(document.referrer);
  queueMicrotask(() => { if (active) send('page_view', referral); });
  const click = (event: MouseEvent) => {
    const link = event.target instanceof Element ? event.target.closest('a') : null;
    if (!link || !root.contains(link)) return;
    const href = link.getAttribute('href') || '';
    if (/^tel:/i.test(href)) send('call_click', referral);
    else if (/^sms:/i.test(href)) send('text_click', referral);
  };
  root.addEventListener('click', click, true);
  return () => { active = false; root.removeEventListener('click', click, true); };
}
export interface AnalyticsReport {
  trackingStartedAt: string; asOf: string; days: number; today: string;
  rows: { day: string; event: AnalyticsEvent; referral: Referral; count: number }[];
}
export function parseReport(value: unknown, days: number): AnalyticsReport {
  const v = value as AnalyticsReport | null;
  if (!v || v.days !== days || !Number.isFinite(Date.parse(v.trackingStartedAt)) || !Number.isFinite(Date.parse(v.asOf)) || !/^\d{4}-\d{2}-\d{2}$/.test(v.today) || !Array.isArray(v.rows) || v.rows.length > 1350 || v.rows.some(r => !/^\d{4}-\d{2}-\d{2}$/.test(r.day) || !['page_view','call_click','text_click'].includes(r.event) || !['direct','search','social','referral','internal'].includes(r.referral) || !Number.isSafeInteger(r.count) || r.count < 0)) throw new Error('Analytics unavailable');
  return v;
}