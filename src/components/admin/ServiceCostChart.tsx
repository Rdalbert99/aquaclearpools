import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtMoney } from '@/lib/inventory-cost';

interface ServiceRow {
  id: string;
  completed_at: string | null;
  created_at?: string | null;
  chemicals_cost?: number | null;
}

export function ServiceCostChart({ services }: { services: ServiceRow[] }) {
  const { chartData, monthly, total } = useMemo(() => {
    const rows = (services || [])
      .map(s => ({
        id: s.id,
        date: new Date(s.completed_at || s.created_at || Date.now()),
        cost: Number(s.chemicals_cost ?? 0),
      }))
      .filter(r => !isNaN(r.date.getTime()))
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
    return { chartData, monthly: [...monthly.entries()].sort((a, b) => b[0].localeCompare(a[0])), total };
  }, [services]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service cost history (internal only)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {chartData.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No cost data yet. Log chemical purchases in Inventory and record chemicals used on each service to populate this chart.
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
                  <span className="font-semibold">All-time chemical cost</span>
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
