import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import Footer from '@/components/layout/Footer';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import {
  Activity,
  BadgeCheck,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardList,
  FileBarChart,
  FlaskConical,
  Gauge,
  LineChart as LineChartIcon,
  LogIn,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import commercialHero from '@/assets/commercial-pool-hero.jpg';

const facilities = [
  'Country Clubs',
  'Apartment Communities',
  'HOA Amenity Centers',
  'Hotels & Resorts',
  'Athletic & Swim Facilities',
  'Municipal Aquatic Centers',
];

const capabilities = [
  { icon: ClipboardList, title: 'Scheduled Maintenance', body: 'Routed, recurring commercial service with documented arrival and completion times on every visit.' },
  { icon: FlaskConical, title: 'Testing & Balancing', body: 'Professional water testing and balancing performed to commercial standards on each service call.' },
  { icon: Activity, title: 'Chemical Management', body: 'Every chemical addition recorded by product, quantity, technician, and visit.' },
  { icon: Gauge, title: 'Equipment Monitoring', body: 'Pumps, filters, feeders, controllers, heaters, and gauges inspected and status-tracked.' },
  { icon: FileBarChart, title: 'Digital Service Reports', body: 'A complete digital report delivered to management after every single visit.' },
  { icon: LineChartIcon, title: 'Chemistry Trending', body: 'Full historical readings charted so problems are caught before they surface.' },
  { icon: Camera, title: 'Photo Documentation', body: 'Photos attached to visits, equipment observations, and reported issues.' },
  { icon: Wrench, title: 'Warranty & Repair Tracking', body: 'Issues documented, vendors contacted, repairs coordinated and verified.' },
  { icon: ShieldCheck, title: 'Management Reporting', body: 'Monthly facility summaries built for boards, GMs, and property managers.' },
];

const sampleReport = {
  facility: 'Sample Facility — Main Pool',
  date: 'Monday, June 9 · 8:05 AM – 9:20 AM',
  technician: 'Aqua Clear Technician',
  readings: [
    { label: 'Free Chlorine', value: '3.2 ppm', target: '2.0 – 4.0', ok: true },
    { label: 'Total Chlorine', value: '3.4 ppm', target: '≤ FC + 0.5', ok: true },
    { label: 'pH', value: '7.5', target: '7.4 – 7.6', ok: true },
    { label: 'Total Alkalinity', value: '92 ppm', target: '80 – 120', ok: true },
    { label: 'Calcium Hardness', value: '265 ppm', target: '200 – 400', ok: true },
    { label: 'Cyanuric Acid', value: '38 ppm', target: '30 – 50', ok: true },
    { label: 'Salt', value: '3,180 ppm', target: '2,700 – 3,400', ok: true },
    { label: 'Water Temperature', value: '84 °F', target: '—', ok: true },
    { label: 'Filter Pressure', value: '22 psi', target: '15 – 20', ok: false },
  ],
  chemicals: [
    { name: 'Muriatic Acid', qty: '0.4 gal' },
    { name: 'Cal-Hypo 73%', qty: '2.5 lb' },
    { name: 'Sodium Bicarbonate', qty: '4 lb' },
  ],
  cleaning: ['Skimmed surface', 'Brushed walls and steps', 'Vacuumed main basin', 'Emptied skimmer and pump baskets', 'Rinsed tile line'],
  equipment: [
    { name: 'Main Filter', status: 'MONITOR', note: 'Pressure 2 psi above clean baseline — backwash scheduled next visit.' },
    { name: 'Circulation Pump', status: 'NORMAL', note: 'No unusual noise, seal dry.' },
  ],
  notes: 'Bather load heavy over the weekend. Chlorine held well; alkalinity adjusted to bring pH drift under control.',
  recommendations: 'Backwash filter on next visit. Recheck CYA in 30 days ahead of peak season.',
};

const trendDays = 14;
const rand = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};
const buildSeries = (base: number, spread: number, decimals = 1) =>
  Array.from({ length: trendDays }, (_, i) => ({
    day: `${i + 1}`,
    value: Number((base + (rand(i + base) - 0.5) * spread).toFixed(decimals)),
  }));

const trendMetrics = [
  { key: 'fc', label: 'Free Chlorine (ppm)', unit: 'ppm', low: 2, high: 4, data: buildSeries(3.1, 1.6, 2), domain: [0, 6] },
  { key: 'ph', label: 'pH', unit: '', low: 7.4, high: 7.6, data: buildSeries(7.5, 0.5, 2), domain: [7, 8] },
  { key: 'ta', label: 'Total Alkalinity (ppm)', unit: 'ppm', low: 80, high: 120, data: buildSeries(97, 40, 0), domain: [50, 150] },
  { key: 'ch', label: 'Calcium Hardness (ppm)', unit: 'ppm', low: 200, high: 400, data: buildSeries(275, 90, 0), domain: [150, 450] },
  { key: 'cya', label: 'Cyanuric Acid (ppm)', unit: 'ppm', low: 30, high: 50, data: buildSeries(40, 18, 0), domain: [10, 70] },
  { key: 'salt', label: 'Salt (ppm)', unit: 'ppm', low: 2700, high: 3400, data: buildSeries(3100, 500, 0), domain: [2400, 3800] },
  { key: 'temp', label: 'Water Temperature (°F)', unit: '°F', low: 78, high: 88, data: buildSeries(84, 6, 0), domain: [70, 95] },
];

const chemicalLog = [
  { date: 'Jun 9', chemical: 'Muriatic Acid', qty: '0.4 gal', tech: 'Technician A', visit: 'Weekly Service #23' },
  { date: 'Jun 9', chemical: 'Cal-Hypo 73%', qty: '2.5 lb', tech: 'Technician A', visit: 'Weekly Service #23' },
  { date: 'Jun 5', chemical: 'Sodium Bicarbonate', qty: '6 lb', tech: 'Technician B', visit: 'Mid-Week Check #12' },
  { date: 'Jun 2', chemical: 'Cyanuric Acid', qty: '4 lb', tech: 'Technician A', visit: 'Weekly Service #22' },
  { date: 'May 28', chemical: 'Pool Salt', qty: '80 lb', tech: 'Technician A', visit: 'Weekly Service #21' },
];

const equipmentCategories = ['Pumps', 'Motors', 'Filters', 'Chemical Feeders', 'Controllers', 'Automation', 'Valves', 'Heaters', 'Gauges', 'Plumbing', 'Water Features'];

const statusStyles: Record<string, string> = {
  'NORMAL': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'MONITOR': 'bg-sky-100 text-sky-800 border-sky-200',
  'ATTENTION NEEDED': 'bg-amber-100 text-amber-900 border-amber-200',
  'ACTION REQUIRED': 'bg-red-100 text-red-800 border-red-200',
};

const warrantySteps = ['Issue Discovered', 'Documented', 'Warranty Contacted', 'Service Scheduled', 'Repair Completed', 'Aqua Clear Verified'];

const Commercial = () => {
  const [activeMetric, setActiveMetric] = useState(trendMetrics[0].key);
  const metric = useMemo(() => trendMetrics.find((m) => m.key === activeMetric)!, [activeMetric]);

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />

      {/* HERO */}
      <section className="relative min-h-[92vh] flex items-center">
        <img
          src={commercialHero}
          alt="Commercial country club swimming pool maintained by Aqua Clear Pools"
          width={1920}
          height={1088}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/70 to-slate-900/40" />
        <div className="relative max-w-6xl mx-auto px-4 pt-32 pb-20 text-primary-foreground">
          <Badge className="mb-5 bg-primary/90 text-primary-foreground border-0 uppercase tracking-widest text-[11px]">
            Commercial Aquatic Facility Management
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight max-w-4xl">
            Commercial Pool Management With Complete Visibility
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-white/85 max-w-2xl">
            Professional water management, preventative equipment monitoring, and digital reporting for
            commercial aquatic facilities.
          </p>
          <p className="mt-4 text-base sm:text-lg font-semibold text-white">
            Every visit. Every reading. Every chemical addition. Documented.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button asChild size="lg" className="text-base">
              <Link to="/contact?type=commercial">
                <Building2 className="mr-2 h-5 w-5" />
                Request Commercial Service
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base bg-white/10 border-white text-white hover:bg-white/20">
              <Link to="/auth/login">
                <LogIn className="mr-2 h-5 w-5" />
                Commercial Client Login
              </Link>
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap gap-2">
            {facilities.map((f) => (
              <span key={f} className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs text-white/90">
                {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* WHY AQUA CLEAR */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-3xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">More Than Pool Cleaning</h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Commercial facilities carry real liability, real equipment budgets, and real member expectations.
              Aqua Clear operates your pool as a managed aquatic asset — with the documentation to prove it.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="border-border/70 hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 rounded-2xl bg-primary text-primary-foreground px-6 py-10 text-center">
            <p className="text-xl sm:text-3xl font-bold tracking-tight">
              Professional Service. Complete Transparency. Documented Results.
            </p>
          </div>
        </div>
      </section>

      {/* DIGITAL REPORTING */}
      <section className="py-20 bg-muted/40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-3xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">A Full Report After Every Visit</h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Management never has to ask what happened at the pool. Each service visit produces a complete
              digital report — delivered automatically and stored permanently in your portal.
            </p>
          </div>

          <Card className="mt-10 overflow-hidden border-border/70 shadow-lg">
            <CardHeader className="bg-foreground text-background py-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{sampleReport.facility}</CardTitle>
                  <p className="text-sm opacity-80">{sampleReport.date}</p>
                </div>
                <div className="text-sm opacity-90">Technician: {sampleReport.technician}</div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-7 space-y-8">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Water Test Results</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {sampleReport.readings.map((r) => (
                    <div key={r.label} className="rounded-lg border bg-card p-3">
                      <p className="text-[11px] text-muted-foreground">{r.label}</p>
                      <p className="text-lg font-bold text-foreground">{r.value}</p>
                      <p className="text-[11px] text-muted-foreground">Target {r.target}</p>
                      <Badge variant="outline" className={`mt-2 text-[10px] ${r.ok ? statusStyles['NORMAL'] : statusStyles['ATTENTION NEEDED']}`}>
                        {r.ok ? 'Normal' : 'Attention'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Chemicals Added</h4>
                  <ul className="space-y-2">
                    {sampleReport.chemicals.map((c) => (
                      <li key={c.name} className="flex justify-between rounded-md border bg-card px-3 py-2 text-sm">
                        <span>{c.name}</span>
                        <span className="font-semibold">{c.qty}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Cleaning Performed</h4>
                  <ul className="space-y-2">
                    {sampleReport.cleaning.map((c) => (
                      <li key={c} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Equipment Observations</h4>
                <div className="space-y-2">
                  {sampleReport.equipment.map((e) => (
                    <div key={e.name} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border bg-card px-3 py-2">
                      <Badge variant="outline" className={`w-fit text-[10px] ${statusStyles[e.status]}`}>{e.status}</Badge>
                      <span className="text-sm font-medium">{e.name}</span>
                      <span className="text-sm text-muted-foreground sm:ml-auto">{e.note}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-lg bg-muted/60 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Technician Notes</h4>
                  <p className="text-sm text-muted-foreground">{sampleReport.notes}</p>
                </div>
                <div className="rounded-lg bg-muted/60 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recommendations</h4>
                  <p className="text-sm text-muted-foreground">{sampleReport.recommendations}</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Photos</h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="aspect-video rounded-md border border-dashed bg-muted flex items-center justify-center">
                      <Camera className="h-5 w-5 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CHEMISTRY TRENDING */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-3xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Chemistry Trending</h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Individual readings tell us what is happening today. Trends help us identify what may happen tomorrow.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {trendMetrics.map((m) => (
              <button
                key={m.key}
                onClick={() => setActiveMetric(m.key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeMetric === m.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <Card className="mt-5 border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{metric.label} — last {trendDays} readings (sample data)</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] pt-2 pl-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metric.data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis domain={metric.domain} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number) => [`${v} ${metric.unit}`.trim(), metric.label]}
                    labelFormatter={(l) => `Reading ${l}`}
                  />
                  <ReferenceArea y1={metric.low} y2={metric.high} fill="hsl(var(--primary))" fillOpacity={0.08} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <p className="mt-3 text-xs text-muted-foreground">
            Shaded band shows the target operating range. Readings outside the band are flagged in your portal.
          </p>
        </div>
      </section>

      {/* CHEMICAL ACCOUNTABILITY */}
      <section className="py-20 bg-muted/40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-3xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Chemical Accountability</h2>
            <p className="mt-4 text-muted-foreground text-lg">
              You see exactly what chemicals were added to your water, how much was used, who added it, and which
              service visit it belongs to — no estimates, no guessing at month end.
            </p>
          </div>

          <Card className="mt-8 overflow-hidden border-border/70">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Chemical</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Technician</TableHead>
                    <TableHead>Service Visit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chemicalLog.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                      <TableCell className="font-medium">{row.chemical}</TableCell>
                      <TableCell className="whitespace-nowrap">{row.qty}</TableCell>
                      <TableCell className="whitespace-nowrap">{row.tech}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{row.visit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </section>

      {/* EQUIPMENT MONITORING */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-3xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Preventative Equipment Monitoring</h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Commercial equipment rarely fails without warning. We inspect and status-track the systems that keep
              your facility open, with photos and technician notes attached to every observation.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {equipmentCategories.map((c) => (
              <span key={c} className="rounded-md border bg-card px-3 py-1.5 text-sm text-muted-foreground">{c}</span>
            ))}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(['NORMAL', 'MONITOR', 'ATTENTION NEEDED', 'ACTION REQUIRED'] as const).map((status) => (
              <Card key={status} className="border-border/70">
                <CardContent className="p-5">
                  <Badge variant="outline" className={`text-[11px] ${statusStyles[status]}`}>{status}</Badge>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {status === 'NORMAL' && 'Operating within expected parameters. No action needed.'}
                    {status === 'MONITOR' && 'Early indicator observed. Tracked and re-inspected each visit.'}
                    {status === 'ATTENTION NEEDED' && 'Service or adjustment recommended soon to avoid failure.'}
                    {status === 'ACTION REQUIRED' && 'Immediate repair or replacement needed. Management notified.'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* WARRANTY */}
      <section className="py-20 bg-muted/40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-3xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Warranty & Repair Coordination</h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Eligible commercial service plans can include warranty coordination. When equipment fails, we document
              the failure, contact the appropriate installer, manufacturer, or warranty provider, coordinate the
              service, and track the issue through completion.
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {warrantySteps.map((step, i) => (
              <div key={step} className="relative rounded-xl border bg-card p-4">
                <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </div>
                <p className="mt-3 text-sm font-medium text-foreground">{step}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm text-muted-foreground max-w-3xl">
            <BadgeCheck className="inline h-4 w-4 mr-1 text-primary" />
            Warranty coverage decisions remain with the manufacturer, installer, or warranty provider. Aqua Clear
            documents, coordinates, and verifies — we do not approve or deny warranty claims.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Every visit. Every reading. Every chemical addition. Documented.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Let's build a service program around your facility — and give your management team the visibility
            they have never had.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/contact?type=commercial">Request Commercial Service</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth/login">Commercial Client Login</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Commercial;
