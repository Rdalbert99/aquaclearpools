import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FacilityScope, technicianName } from './types';
import { formatDate } from '@/lib/commercial';

interface Props {
  scope: FacilityScope;
}

/** Derived entirely from the existing service_chemical_usage records. */
export const ChemicalUsagePanel = ({ scope }: Props) => {
  const rows = useMemo(() => {
    const serviceById = new Map(scope.services.map((s) => [s.id, s]));
    return scope.chemUsage
      .map((u) => {
        const service = serviceById.get(u.service_id);
        const pool = scope.pools.find((p) => p.client_id === service?.client_id);
        return {
          ...u,
          performed_at: service?.performed_at ?? null,
          technician: technicianName(scope, service?.technician_id ?? null),
          poolName: pool?.name ?? 'Pool',
        };
      })
      .filter((r) => !!r.performed_at)
      .sort((a, b) => new Date(b.performed_at!).getTime() - new Date(a.performed_at!).getTime());
  }, [scope]);

  const totalsFor = (days: number | 'ytd') => {
    const cutoff =
      days === 'ytd'
        ? new Date(new Date().getFullYear(), 0, 1).getTime()
        : Date.now() - days * 86_400_000;
    const totals = new Map<string, { label: string; unit: string; qty: number }>();
    rows.forEach((r) => {
      if (new Date(r.performed_at!).getTime() < cutoff) return;
      const key = `${r.chemical_id}|${r.unit}`;
      const entry = totals.get(key) ?? { label: r.chemical_label, unit: r.unit, qty: 0 };
      entry.qty += Number(r.quantity_used) || 0;
      totals.set(key, entry);
    });
    return [...totals.values()].sort((a, b) => b.qty - a.qty);
  };

  const summaries: { title: string; data: ReturnType<typeof totalsFor> }[] = [
    { title: '30-Day Usage', data: totalsFor(30) },
    { title: '90-Day Usage', data: totalsFor(90) },
    { title: 'Year to Date', data: totalsFor('ytd') },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        {summaries.map((s) => (
          <Card key={s.title}>
            <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wide">{s.title}</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {s.data.length === 0 && <p className="text-sm text-muted-foreground">No chemicals recorded.</p>}
              {s.data.map((d) => (
                <div key={`${d.label}-${d.unit}`} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-semibold">{Number(d.qty.toFixed(2))} {d.unit}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Every chemical addition</CardTitle></CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chemical</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Pool</TableHead>
                  <TableHead className="hidden sm:table-cell">Technician</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">No chemical usage recorded yet.</TableCell></TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.chemical_label}</TableCell>
                    <TableCell>{r.quantity_used} {r.unit}</TableCell>
                    <TableCell>{formatDate(r.performed_at)}</TableCell>
                    <TableCell className="hidden sm:table-cell">{r.poolName}</TableCell>
                    <TableCell className="hidden sm:table-cell">{r.technician}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
