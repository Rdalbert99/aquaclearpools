import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, Legend,
} from 'recharts';
import { CHEMICAL_RANGES, type ChemicalId, isInRange } from '@/lib/pool-chemistry';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ServiceRow {
  service_date: string;
  ph_level: number | null;
  chlorine_level: number | null;
  alkalinity_level: number | null;
  cyanuric_acid_level: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readings?: any;
}

interface Props {
  services: ServiceRow[];
}

const CHEM_ORDER: { id: ChemicalId; field: keyof ServiceRow; readingKey: string; color: string }[] = [
  { id: 'ph',         field: 'ph_level',              readingKey: 'ph',   color: 'hsl(200 90% 45%)' },
  { id: 'chlorine',   field: 'chlorine_level',        readingKey: 'fc',   color: 'hsl(140 70% 40%)' },
  { id: 'alkalinity', field: 'alkalinity_level',      readingKey: 'ta',   color: 'hsl(280 60% 50%)' },
  { id: 'cya',        field: 'cyanuric_acid_level',   readingKey: 'cya',  color: 'hsl(30 90% 50%)'  },
  { id: 'salt',       field: 'salt_level' as any,     readingKey: 'salt', color: 'hsl(0 70% 50%)'   },
];

function extractValue(svc: ServiceRow, chem: typeof CHEM_ORDER[number]): number | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (svc as any)[chem.field];
  if (r != null && !isNaN(Number(r))) return Number(r);
  const v = svc.readings?.[chem.readingKey];
  return v != null && !isNaN(Number(v)) ? Number(v) : null;
}

export function ClientReadingsChart({ services }: Props) {
  const data = useMemo(() => {
    return [...services]
      .filter(s => s.service_date)
      .sort((a, b) => new Date(a.service_date).getTime() - new Date(b.service_date).getTime())
      .map(s => {
        const row: Record<string, number | string | null> = {
          date: new Date(s.service_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        };
        CHEM_ORDER.forEach(c => { row[c.id] = extractValue(s, c); });
        return row;
      });
  }, [services]);

  if (data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Water Chemistry Trends</CardTitle>
        <CardDescription>Track readings over time. Shaded bands show the ideal range.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Sparkline cards per chemical */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {CHEM_ORDER.map(chem => {
            const series = data.map(d => d[chem.id]).filter(v => v != null) as number[];
            const latest = series[series.length - 1] ?? null;
            const prev = series[series.length - 2] ?? null;
            const trend = latest == null || prev == null
              ? 'flat'
              : latest > prev ? 'up' : latest < prev ? 'down' : 'flat';
            const range = CHEMICAL_RANGES[chem.id];
            const inRange = latest != null && isInRange(chem.id, latest) === 'in';

            return (
              <div key={chem.id} className="border rounded-lg p-3 bg-card">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-muted-foreground">{range.label}</p>
                  {trend === 'up' && <TrendingUp className="h-3 w-3 text-muted-foreground" />}
                  {trend === 'down' && <TrendingDown className="h-3 w-3 text-muted-foreground" />}
                  {trend === 'flat' && <Minus className="h-3 w-3 text-muted-foreground" />}
                </div>
                <div className={`text-lg font-bold ${latest != null && !inRange ? 'text-destructive' : ''}`}>
                  {latest != null ? `${latest}${range.unit ? ' ' + range.unit : ''}` : '—'}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Ideal {range.min}–{range.max}{range.unit ? ' ' + range.unit : ''}
                </p>
                <div className="h-8 mt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                      <Line
                        type="monotone"
                        dataKey={chem.id}
                        stroke={chem.color}
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>

        {/* Overview multi-line charts (one per chemical so the y-scales fit) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {CHEM_ORDER.map(chem => {
            const range = CHEMICAL_RANGES[chem.id];
            const hasData = data.some(d => d[chem.id] != null);
            if (!hasData) return null;
            return (
              <div key={chem.id} className="h-48">
                <p className="text-sm font-medium mb-1">{range.label}</p>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} domain={['auto', 'auto']} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <ReferenceArea y1={range.min} y2={range.max} fill={chem.color} fillOpacity={0.08} />
                    <Line
                      type="monotone"
                      dataKey={chem.id}
                      name={range.label}
                      stroke={chem.color}
                      strokeWidth={2}
                      connectNulls
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
