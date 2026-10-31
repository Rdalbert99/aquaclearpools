import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Phone, MessageSquare, RefreshCw, ExternalLink } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { parseReport, type AnalyticsReport } from '@/lib/website-analytics';

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [refresh, setRefresh] = useState(0);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    setLoading(true); setError(false); setReport(null);
    void supabase.functions.invoke('website-analytics', { body: { action: 'report', days } }).then(({ data, error: failure }) => {
      if (!current) return;
      try { if (failure) throw failure; setReport(parseReport(data, days)); }
      catch { setError(true); }
      finally { setLoading(false); }
    }).catch(() => { if (current) { setError(true); setLoading(false); } });
    return () => { current = false; };
  }, [days, refresh]);
  const total = (event: string) => report?.rows.filter(r => r.event === event).reduce((n, r) => n + r.count, 0) ?? 0;
  const trend = report ? Array.from({ length: days }, (_, i) => {
    const date = new Date(`${report.today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - days + 1 + i);
    const day = date.toISOString().slice(0, 10);
    return { day, pageviews: report.rows.filter(r => r.day === day && r.event === 'page_view').reduce((n, r) => n + r.count, 0) };
  }) : [];
  return <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold">Website Analytics</h1><p className="text-muted-foreground">Aqua Clear Pools · public homepage</p></div><Button variant="outline" disabled={loading} onClick={() => setRefresh(n => n + 1)}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button></header>
    <div className="flex flex-wrap gap-2" aria-label="Report period">{[7,30,90].map(n => <Button key={n} variant={days === n ? 'default' : 'outline'} aria-pressed={days === n} onClick={() => setDays(n)}>{n} days</Button>)}</div>
    {loading && <p role="status">Loading analytics…</p>}
    {error && <p role="alert" className="text-destructive">Analytics unavailable. Please refresh to try again.</p>}
    {report && <>
      <p className="text-sm text-muted-foreground">Tracking started {new Date(report.trackingStartedAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT. Daily totals use Chicago time. Updated {new Date(report.asOf).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT.</p>
      <div className="grid gap-4 sm:grid-cols-3">{([{ event:'page_view', label:'Pageviews', icon:BarChart3 }, { event:'call_click', label:'Call clicks', icon:Phone }, { event:'text_click', label:'Text clicks', icon:MessageSquare }]).map(item => <Card key={item.event}><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">{item.label}</CardTitle><item.icon className="h-5 w-5 text-primary" /></CardHeader><CardContent className="text-3xl font-semibold">{total(item.event).toLocaleString()}</CardContent></Card>)}</div>
      {!report.rows.length && <p>No homepage events recorded in this period.</p>}
      <section aria-label="Daily pageviews"><h2 className="text-lg font-semibold mb-4">Daily pageviews</h2><div className="h-64 w-full min-w-0"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid stroke="hsl(var(--border))" /><XAxis dataKey="day" tickFormatter={d => d.slice(5)} minTickGap={35} /><YAxis allowDecimals={false} width={40} /><Tooltip /><Line type="monotone" dataKey="pageviews" stroke="hsl(var(--primary))" dot={false} /></LineChart></ResponsiveContainer></div></section>
      <section><h2 className="text-lg font-semibold mb-3">Pageview referral categories</h2><dl className="divide-y divide-border">{['direct','search','social','referral','internal'].map(category => <div key={category} className="flex justify-between py-3"><dt className="capitalize">{category}</dt><dd>{report.rows.filter(r => r.event === 'page_view' && r.referral === category).reduce((n,r) => n+r.count,0).toLocaleString()}</dd></div>)}</dl></section>
    </>}
    <footer className="border-t pt-4 space-y-3 text-sm text-muted-foreground"><p>These are page and link-click counts, not unique visitors, connected calls or sent texts. Public-page counts may include our own checks. No customer portal traffic is tracked here.</p><p>Prospective first-party counts only. Blockers, network failures and shared traffic caps can undercount; automated traffic can inflate counts.</p><Button asChild variant="link" className="px-0 h-auto whitespace-normal text-left"><a href="https://lovable.dev/projects/413f3da6-68de-43ec-849a-5c8f25cadb71" target="_blank" rel="noopener noreferrer">Earlier Lovable history <ExternalLink className="ml-2 h-4 w-4 shrink-0" /></a></Button><p>Open the project, then More → Analytics. That separate history includes native app traffic and is not a prospect count.</p></footer>
  </main>;
}