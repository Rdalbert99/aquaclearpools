import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtMoney } from '@/lib/inventory-cost';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ServiceRow {
  id: string;
  completed_at: string | null;
  created_at?: string | null;
  chemicals_cost?: number | null;
}

interface Props {
  services: ServiceRow[];
  /** Optional label used in the exported filename / PDF header (e.g. client name). */
  contextLabel?: string;
}

function toDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function slugify(s: string) {
  return (s || 'service-costs').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'service-costs';
}

function downloadBlob(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ServiceCostChart({ services, contextLabel }: Props) {
  // Default range: earliest → today, based on the incoming data
  const initialRange = useMemo(() => {
    const dates = (services || [])
      .map(s => new Date(s.completed_at || s.created_at || ''))
      .filter(d => !isNaN(d.getTime()));
    const today = new Date();
    const earliest = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : new Date(today.getFullYear(), today.getMonth() - 5, 1);
    return { from: toDateInput(earliest), to: toDateInput(today) };
  }, [services]);

  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);

  const { chartData, monthly, total, rows } = useMemo(() => {
    const fromTs = from ? new Date(from + 'T00:00:00').getTime() : -Infinity;
    const toTs = to ? new Date(to + 'T23:59:59').getTime() : Infinity;

    const rows = (services || [])
      .map(s => ({
        id: s.id,
        date: new Date(s.completed_at || s.created_at || Date.now()),
        cost: Number(s.chemicals_cost ?? 0),
      }))
      .filter(r => !isNaN(r.date.getTime()) && r.date.getTime() >= fromTs && r.date.getTime() <= toTs)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const chartData = rows.map(r => ({
      label: r.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      cost: Number(r.cost.toFixed(2)),
    }));

    const monthly = new Map<string, { label: string; count: number; total: number }>();
    rows.forEach(r => {
      const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`;
      const label = r.date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const cur = monthly.get(key) ?? { label, count: 0, total: 0 };
      cur.count += 1;
      cur.total += r.cost;
      monthly.set(key, cur);
    });

    const total = rows.reduce((s, r) => s + r.cost, 0);
    return {
      chartData,
      monthly: [...monthly.entries()].sort((a, b) => b[0].localeCompare(a[0])),
      total,
      rows,
    };
  }, [services, from, to]);

  const rangeLabel = `${from || '—'} to ${to || '—'}`;
  const baseName = `service-costs-${slugify(contextLabel || '')}-${from}_to_${to}`;

  function exportCsv() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push(['Section', 'Date', 'Label', 'Service count', 'Chemical cost'].map(esc).join(','));
    rows.forEach(r => {
      lines.push(['Service', toDateInput(r.date), '', '', r.cost.toFixed(2)].map(esc).join(','));
    });
    monthly.forEach(([, m]) => {
      lines.push(['Monthly total', '', m.label, m.count, m.total.toFixed(2)].map(esc).join(','));
    });
    lines.push(['Grand total', '', rangeLabel, rows.length, total.toFixed(2)].map(esc).join(','));
    downloadBlob(`${baseName}.csv`, 'text/csv;charset=utf-8', lines.join('\n'));
  }

  function exportPdf() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Service Cost Report', 14, 18);
    doc.setFontSize(10);
    doc.text(`${contextLabel ? contextLabel + ' · ' : ''}Range: ${rangeLabel}`, 14, 26);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);

    autoTable(doc, {
      startY: 40,
      head: [['Month', 'Services', 'Chemical cost']],
      body: monthly.map(([, m]) => [m.label, String(m.count), fmtMoney(m.total)]),
      foot: [['Total', String(rows.length), fmtMoney(total)]],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [0, 91, 150] },
      footStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: 'bold' },
    });

    const afterMonthlyY = (doc as any).lastAutoTable?.finalY ?? 60;
    autoTable(doc, {
      startY: afterMonthlyY + 8,
      head: [['Date', 'Chemical cost']],
      body: rows.map(r => [toDateInput(r.date), fmtMoney(r.cost)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 153, 229] },
    });

    doc.save(`${baseName}.pdf`);
  }

  const hasData = rows.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service cost history (internal only)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] items-end">
          <div>
            <Label htmlFor="cost-from" className="text-xs">From</Label>
            <Input id="cost-from" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cost-to" className="text-xs">To</Label>
            <Input id="cost-to" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!hasData}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={!hasData}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>

        {!hasData ? (
          <div className="text-sm text-muted-foreground">
            No cost data in this range. Log chemical purchases in Inventory and record chemicals used on each service, then adjust the dates above.
          </div>
        ) : (
          <>
            <div className="h-56 w-full">
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
                  <Bar dataKey="cost" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Monthly totals</div>
              <div className="rounded-md border divide-y text-sm">
                {monthly.map(([k, m]) => (
                  <div key={k} className="flex justify-between px-3 py-2">
                    <span>{m.label}</span>
                    <span className="text-muted-foreground">
                      {m.count} service{m.count === 1 ? '' : 's'} · <strong className="text-foreground">{fmtMoney(m.total)}</strong>
                    </span>
                  </div>
                ))}
                <div className="flex justify-between px-3 py-2 bg-muted/40">
                  <span className="font-semibold">Total in range</span>
                  <span className="font-semibold">{fmtMoney(total)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
