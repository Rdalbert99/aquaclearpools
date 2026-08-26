import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FacilityScope } from './types';
import {
  CHEM_RANGES,
  chemStatus,
  formatDate,
  RANGE_OPTIONS,
  RangeKey,
  rangeStart,
  readingsFromService,
} from '@/lib/commercial';
import { StatusBadge } from './StatusBadge';

interface Props {
  scope: FacilityScope;
}

/** Graphs real historical readings pulled from the existing services table. */
export const ChemistryPanel = ({ scope }: Props) => {
  const [range, setRange] = useState<RangeKey>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [poolFilter, setPoolFilter] = useState(scope.pools[0]?.id ?? 'all');

  const { from, to } = useMemo(() => {
    if (range === 'custom') {
      return {
        from: customFrom ? new Date(customFrom) : rangeStart('30d'),
        to: customTo ? new Date(`${customTo}T23:59:59`) : new Date(),
      };
    }
    return { from: rangeStart(range), to: new Date() };
  }, [range, customFrom, customTo]);

  const clientId = scope.pools.find((p) => p.id === poolFilter)?.client_id ?? null;

  const points = useMemo(() => {
    return scope.services
      .filter((s) => (clientId ? s.client_id === clientId : true))
      .filter((s) => {
        const t = new Date(s.performed_at).getTime();
        return t >= from.getTime() && t <= to.getTime();
      })
      .sort((a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime())
      .map((s) => {
        const r = readingsFromService(s);
        return {
          date: new Date(s.performed_at).getTime(),
          label: formatDate(s.performed_at),
          ...r,
        } as Record<string, number | string | null>;
      });
  }, [scope.services, clientId, from, to]);

  const latest = points[points.length - 1];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap gap-1.5">
            {RANGE_OPTIONS.map((opt) => (
              <Button
                key={opt.key}
                size="sm"
                variant={range === opt.key ? 'default' : 'outline'}
                onClick={() => setRange(opt.key)}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {range === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="from" className="text-xs">From</Label>
                <Input id="from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="to" className="text-xs">To</Label>
                <Input id="to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}

          {scope.pools.length > 1 && (
            <Select value={poolFilter} onValueChange={setPoolFilter}>
              <SelectTrigger><SelectValue placeholder="Select pool" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All pools combined</SelectItem>
                {scope.pools.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-muted-foreground">
            {points.length} test{points.length === 1 ? '' : 's'} between {formatDate(from)} and {formatDate(to)}
          </p>
        </CardContent>
      </Card>

      {CHEM_RANGES.map((r) => {
        const series = points.filter((p) => p[r.key] !== null && p[r.key] !== undefined);
        if (series.length === 0) return null;
        const currentValue = latest?.[r.key];
        return (
          <Card key={r.key}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">{r.label}</CardTitle>
                {typeof currentValue === 'number' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{currentValue.toFixed(r.decimals)} {r.unit}</span>
                    <StatusBadge status={chemStatus(r, currentValue)} size="sm" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Ideal {r.ideal[0]}–{r.ideal[1]} {r.unit}</p>
            </CardHeader>
            <CardContent className="pl-0 pr-2">
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <ReferenceArea y1={r.ideal[0]} y2={r.ideal[1]} fill="hsl(var(--primary))" fillOpacity={0.08} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={24} />
                    <YAxis tick={{ fontSize: 10 }} width={44} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: number) => [`${v} ${r.unit}`, r.label]}
                    />
                    <Line
                      type="monotone"
                      dataKey={r.key}
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {points.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No test results in this date range.</CardContent></Card>
      )}
    </div>
  );
};
