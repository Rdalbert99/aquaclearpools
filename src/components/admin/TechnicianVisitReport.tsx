import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { chemicalTotals, csvCell, dailyTotals, serviceDay, type Usage, type Visit } from '@/lib/technician-report';
import { durationLabel, serviceMinutes, timeSource } from '@/lib/service-duration';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const clock = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }) : 'Not recorded';
export default function TechnicianVisitReport() {
  const [from, setFrom] = useState(today), [to, setTo] = useState(today);
  const [tech, setTech] = useState('all');
  const [visits, setVisits] = useState<Visit[]>([]), [usage, setUsage] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setVisits([]); setUsage([]); setError(''); setLoading(true);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
      setError('Choose a valid start and end date.'); setLoading(false); return;
    }
    void (async () => {
      try {
        const all: Visit[] = [];
        // Broad UTC bounds followed by Central-day filtering, including DST days.
        const upper = new Date(`${to}T12:00:00Z`); upper.setUTCDate(upper.getUTCDate() + 1);
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await supabase.from('services').select('id,service_date,status,technician_id,duration,duration_minutes,started_at,completed_at,chemicals_added,users(name),clients(customer)')
            .eq('status', 'completed').gte('service_date', from).lt('service_date', upper.toISOString()).order('service_date', { ascending: false }).order('id').range(offset, offset + 499);
          if (cancelled) return;
          if (error) throw error;
          all.push(...((data ?? []) as unknown as Visit[]).filter(s => serviceDay(s) >= from && serviceDay(s) <= to));
          if ((data ?? []).length < 500) break;
        }
        const chemicals: Usage[] = [];
        for (let i = 0; i < all.length; i += 100) {
          const ids = all.slice(i, i + 100).map(s => s.id);
          for (let offset = 0; ; offset += 500) {
            const { data, error } = await supabase.from('service_chemical_usage').select('service_id,chemical_id,chemical_label,unit,quantity_used').in('service_id', ids).order('id').range(offset, offset + 499);
            if (cancelled) return;
            if (error) throw error;
            chemicals.push(...(data ?? []) as unknown as Usage[]);
            if ((data ?? []).length < 500) break;
          }
        }
        setVisits(all); setUsage(chemicals);
      } catch { if (!cancelled) setError('Could not load the complete report. No partial totals are shown. Try Refresh.'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [from, to, refresh]);
  const selected = useMemo(() => visits.filter(s => tech === 'all' || (s.technician_id ?? 'unassigned') === tech), [visits, tech]);
  const groups = dailyTotals(selected);
  const techs = [...new Map(visits.map(s => [s.technician_id ?? 'unassigned', s.users?.name || 'Unassigned'])).entries()];
  const chemicalsFor = (ids: string[]) => chemicalTotals(usage.filter(u => ids.includes(u.service_id)));
  function exportCsv() {
    const rows: unknown[][] = [['Service date','Technician','Customer','Start (Central)','Complete (Central)','Minutes','Time source','Chemicals recorded']];
    selected.forEach(s => rows.push([serviceDay(s), s.users?.name || 'Unassigned', s.clients?.customer || 'Unknown customer', clock(s.started_at), clock(s.completed_at), serviceMinutes(s) ?? '', timeSource(s), chemicalsFor([s.id]) || s.chemicals_added || 'Not recorded']));
    rows.push([], ['Daily totals (service date)', 'Technician','Visits','Timed minutes','Recorded/manual minutes','Missing time','Chemicals (structured records only)']);
    groups.forEach(g => rows.push([g.day,g.name,g.visits,g.timed,g.recorded,g.missing,chemicalsFor(g.ids) || 'Not recorded']));
    const url = URL.createObjectURL(new Blob([rows.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `technician-visits-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  return <Card><CardHeader><CardTitle>Technician time &amp; chemicals</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">Completed visits by service date. Clock times use Central time. Visit elapsed time is not payroll or shift time: travel is not added, and breaks within a visit are not separately tracked or deducted. Recorded/manual time is separate from timed visits.</p>
    <div className="flex flex-wrap gap-3 items-end">
      <label className="text-sm">From<Input type="date" value={from} onChange={e => { setTech('all'); setFrom(e.target.value); }} /></label>
      <label className="text-sm">Through<Input type="date" value={to} onChange={e => { setTech('all'); setTo(e.target.value); }} /></label>
      <label className="text-sm">Technician<select aria-label="Technician" className="block rounded border bg-background p-2" value={tech} onChange={e => setTech(e.target.value)}><option value="all">All technicians</option>{techs.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <Button variant="outline" onClick={() => setRefresh(n => n+1)} disabled={loading}>Refresh</Button>
      <Button variant="outline" onClick={exportCsv} disabled={loading || !!error || !selected.length}>Export visits &amp; totals</Button>
    </div>
    {loading ? <p role="status">Loading visits and chemicals…</p> : error ? <p role="alert" className="text-destructive">{error}</p> : <>
      {!selected.length && <p>No completed visits in this selection.</p>}
      {groups.map(g => <section key={`${g.day}-${g.technicianId}`} className="rounded border p-3 space-y-2">
        <h3 className="font-semibold">{g.day} · {g.name}</h3>
        <p>{g.visits} visits · {g.timed} timed min · {g.recorded} recorded/manual min · {g.missing} missing time</p>
        <p className="text-sm">Chemical totals: {chemicalsFor(g.ids) || 'No structured chemical quantities recorded'}</p>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left"><th className="p-2">Customer</th><th className="p-2">Start</th><th className="p-2">Complete</th><th className="p-2">Time</th><th className="p-2">Chemicals</th></tr></thead><tbody>
          {selected.filter(s => g.ids.includes(s.id)).map(s => <tr key={s.id} className="border-t"><td className="p-2">{s.clients?.customer || 'Unknown customer'}</td><td className="p-2 whitespace-nowrap">{clock(s.started_at)}</td><td className="p-2 whitespace-nowrap">{clock(s.completed_at)}</td><td className="p-2 whitespace-nowrap">{durationLabel(s)}<br/><span className="text-muted-foreground">{timeSource(s)}</span></td><td className="p-2">{chemicalsFor([s.id]) || s.chemicals_added || 'Not recorded'}</td></tr>)}
        </tbody></table></div>
      </section>)}
      <p className="text-xs text-muted-foreground">Chemical totals include structured quantity records only. Older text-only notes appear at each visit but are not guessed into totals. Missing records do not mean no chemicals were used.</p>
    </>}
  </CardContent></Card>;
}
