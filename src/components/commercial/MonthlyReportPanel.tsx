import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Printer } from 'lucide-react';
import { FacilityScope, technicianName } from './types';
import {
  CHEM_RANGES,
  chemStatus,
  CommercialStatus,
  formatDate,
  ISSUE_STATUS_LABEL,
  IssueStatus,
  readingsFromService,
  STATUS_LABEL,
  worstStatus,
} from '@/lib/commercial';
import { StatusBadge } from './StatusBadge';

interface Props {
  scope: FacilityScope;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Executive summary generated from portal data.
 * Structured so a scheduled job can render the same summary into an email later.
 */
export const MonthlyReportPanel = ({ scope }: Props) => {
  const months = useMemo(() => {
    const set = new Set<string>();
    scope.services.forEach((s) => set.add(monthKey(new Date(s.performed_at))));
    set.add(monthKey(new Date()));
    return [...set].sort().reverse();
  }, [scope.services]);

  const [month, setMonth] = useState(months[0]);

  const report = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    const services = scope.services.filter((s) => {
      const t = new Date(s.performed_at);
      return t >= start && t < end;
    });

    const usage = new Map<string, { label: string; unit: string; qty: number }>();
    scope.chemUsage
      .filter((u) => services.some((s) => s.id === u.service_id))
      .forEach((u) => {
        const key = `${u.chemical_id}|${u.unit}`;
        const e = usage.get(key) ?? { label: u.chemical_label, unit: u.unit, qty: 0 };
        e.qty += Number(u.quantity_used) || 0;
        usage.set(key, e);
      });

    const readingStats = CHEM_RANGES.map((range) => {
      const values = services
        .map((s) => readingsFromService(s)[range.key])
        .filter((v): v is number => v !== null && v !== undefined);
      if (!values.length) return null;
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return {
        range,
        avg,
        min: Math.min(...values),
        max: Math.max(...values),
        status: worstStatus(...values.map((v) => chemStatus(range, v))),
      };
    }).filter(Boolean) as { range: typeof CHEM_RANGES[number]; avg: number; min: number; max: number; status: CommercialStatus }[];

    const issuesOpened = scope.issues.filter((i) => new Date(i.opened_at) >= start && new Date(i.opened_at) < end);
    const issuesClosed = scope.issues.filter((i) => i.closed_at && new Date(i.closed_at) >= start && new Date(i.closed_at) < end);
    const openNow = scope.issues.filter((i) => i.status !== 'completed');

    const overall = worstStatus(
      ...readingStats.map((r) => r.status),
      ...(openNow.length ? (['attention_needed'] as CommercialStatus[]) : []),
    );

    const title = start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return { title, services, usage: [...usage.values()], readingStats, issuesOpened, issuesClosed, openNow, overall };
  }, [month, scope]);

  const download = () => {
    const lines = [
      `Aqua Clear Pools — Monthly Executive Summary`,
      `${scope.organization?.name ?? ''} — ${scope.facility.name}`,
      `Period: ${report.title}`,
      `Overall status: ${STATUS_LABEL[report.overall]}`,
      '',
      `Service visits completed: ${report.services.length}`,
      '',
      'Water chemistry averages:',
      ...report.readingStats.map(
        (r) => `  ${r.range.label}: avg ${r.avg.toFixed(r.range.decimals)} (min ${r.min}, max ${r.max}) ${r.range.unit} — ${STATUS_LABEL[r.status]}`,
      ),
      '',
      'Chemicals used:',
      ...(report.usage.length ? report.usage.map((u) => `  ${u.label}: ${Number(u.qty.toFixed(2))} ${u.unit}`) : ['  None recorded']),
      '',
      `Issues opened: ${report.issuesOpened.length}`,
      ...report.issuesOpened.map((i) => `  ${formatDate(i.opened_at)} — ${i.title}`),
      `Issues completed: ${report.issuesClosed.length}`,
      ...report.issuesClosed.map((i) => `  ${formatDate(i.closed_at)} — ${i.title}`),
      `Issues still open: ${report.openNow.length}`,
      ...report.openNow.map((i) => `  ${i.title} — ${ISSUE_STATUS_LABEL[i.status as IssueStatus] ?? i.status}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aqua-clear-${scope.facility.name.replace(/\s+/g, '-').toLowerCase()}-${month}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" /> Print</Button>
        <Button size="sm" variant="outline" onClick={download}><Download className="mr-1 h-4 w-4" /> Download</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{scope.facility.name} — {report.title}</CardTitle>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <StatusBadge status={report.overall} />
            <span className="text-sm text-muted-foreground">{report.services.length} service visits</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <Section title="Water chemistry">
            {report.readingStats.length === 0 && <p className="text-sm text-muted-foreground">No tests recorded this month.</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {report.readingStats.map((r) => (
                <div key={r.range.key} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <div>
                    <p className="font-medium">{r.range.label}</p>
                    <p className="text-xs text-muted-foreground">
                      avg {r.avg.toFixed(r.range.decimals)} · range {r.min}–{r.max} {r.range.unit}
                    </p>
                  </div>
                  <StatusBadge status={r.status} size="sm" />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Chemicals used">
            {report.usage.length === 0 && <p className="text-sm text-muted-foreground">None recorded.</p>}
            <ul className="text-sm">
              {report.usage.map((u) => (
                <li key={`${u.label}-${u.unit}`} className="flex justify-between border-b py-1 last:border-0">
                  <span>{u.label}</span>
                  <span className="font-medium">{Number(u.qty.toFixed(2))} {u.unit}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Service visits">
            {report.services.length === 0 && <p className="text-sm text-muted-foreground">No visits recorded.</p>}
            <ul className="text-sm">
              {report.services.map((s) => (
                <li key={s.id} className="flex justify-between border-b py-1 last:border-0">
                  <span>{formatDate(s.performed_at)}</span>
                  <span className="text-muted-foreground">{technicianName(scope, s.technician_id)}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Equipment & issues">
            <p className="text-sm">
              {report.issuesOpened.length} opened · {report.issuesClosed.length} completed · {report.openNow.length} currently open
            </p>
            <ul className="mt-1 text-sm text-muted-foreground">
              {report.openNow.map((i) => (
                <li key={i.id}>• {i.title} — {ISSUE_STATUS_LABEL[i.status as IssueStatus] ?? i.status}</li>
              ))}
            </ul>
          </Section>
        </CardContent>
      </Card>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">{title}</h3>
    {children}
  </div>
);
