import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/commercial/StatusBadge';
import {
  CHEM_RANGES,
  CommercialStatus,
  chemStatus,
  chemistryStatus,
  formatDate,
  readingsFromService,
  worstStatus,
  daysSince,
} from '@/lib/commercial';
import { useCommercialExecutive } from '@/hooks/useCommercialExecutive';
import type { ServiceRow } from '@/lib/commercial';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Droplets,
  Loader2,
  RefreshCw,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PoolSummary {
  id: string;
  name: string;
  facilityName: string;
  clientId: string | null;
  lastService: ServiceRow | null;
  visits30: number;
  chemistry: CommercialStatus;
  readings: Record<string, number | null>;
}

const CommercialExecutive = () => {
  const data = useCommercialExecutive(180);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const orgs = useMemo(() => {
    const thirtyAgo = Date.now() - 30 * 86_400_000;
    const clientsById = new Map(data.clients.map((c) => [c.id, c]));

    return data.organizations.map((org) => {
      const facilities = data.facilities.filter((f) => f.organization_id === org.id);
      const facilityIds = new Set(facilities.map((f) => f.id));
      const pools = data.pools.filter((p) => facilityIds.has(p.facility_id));
      const clientIds = new Set(pools.map((p) => p.client_id).filter((v): v is string => !!v));

      const services = data.services.filter((s) => s.client_id && clientIds.has(s.client_id));
      const equipment = data.equipment.filter((e) => facilityIds.has(e.facility_id));
      const issues = data.issues.filter((i) => facilityIds.has(i.facility_id) && i.status !== 'completed');
      const followUps = data.followUps.filter(
        (f) => clientIds.has(f.client_id) && f.status !== 'completed' && f.status !== 'cancelled',
      );

      const poolSummaries: PoolSummary[] = pools.map((p) => {
        const poolServices = p.client_id ? services.filter((s) => s.client_id === p.client_id) : [];
        const last = poolServices[0] ?? null;
        return {
          id: p.id,
          name: p.name,
          facilityName: facilities.find((f) => f.id === p.facility_id)?.name ?? 'Facility',
          clientId: p.client_id,
          lastService: last,
          visits30: poolServices.filter((s) => new Date(s.performed_at).getTime() >= thirtyAgo).length,
          chemistry: chemistryStatus(last),
          readings: last ? readingsFromService(last) : {},
        };
      });

      const chemistry = poolSummaries.length
        ? worstStatus(...poolSummaries.map((p) => p.chemistry))
        : ('monitor' as CommercialStatus);
      const equipmentStatusRoll = equipment.length
        ? worstStatus(...equipment.map((e) => e.status as CommercialStatus))
        : ('normal' as CommercialStatus);
      const issueStatus: CommercialStatus = issues.some((i) => i.severity === 'action_required')
        ? 'action_required'
        : issues.length
          ? 'attention_needed'
          : 'normal';

      const lastVisit = services[0]?.performed_at ?? null;
      const overdue = poolSummaries.some((p) => {
        const client = p.clientId ? clientsById.get(p.clientId) : null;
        if (!client?.next_service_date) return false;
        return new Date(client.next_service_date).getTime() < Date.now() - 86_400_000;
      });

      return {
        org,
        facilities,
        pools: poolSummaries,
        services,
        equipment,
        issues,
        followUps,
        visits30: services.filter((s) => new Date(s.performed_at).getTime() >= thirtyAgo).length,
        lastVisit,
        chemistry,
        equipmentStatus: equipmentStatusRoll,
        issueStatus,
        overdue,
        status: worstStatus(chemistry, equipmentStatusRoll, issueStatus, overdue ? 'attention_needed' : 'normal'),
      };
    });
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? orgs.filter(
          (o) =>
            o.org.name.toLowerCase().includes(q) ||
            o.facilities.some((f) => f.name.toLowerCase().includes(q)) ||
            o.pools.some((p) => p.name.toLowerCase().includes(q)),
        )
      : orgs;
    const rank: Record<CommercialStatus, number> = {
      action_required: 0,
      attention_needed: 1,
      monitor: 2,
      normal: 3,
    };
    return [...list].sort((a, b) => rank[a.status] - rank[b.status] || a.org.name.localeCompare(b.org.name));
  }, [orgs, search]);

  const totals = useMemo(
    () => ({
      orgs: orgs.length,
      pools: orgs.reduce((n, o) => n + o.pools.length, 0),
      visits30: orgs.reduce((n, o) => n + o.visits30, 0),
      issues: orgs.reduce((n, o) => n + o.issues.length, 0),
      followUps: orgs.reduce((n, o) => n + o.followUps.length, 0),
      needsAttention: orgs.filter((o) => o.status === 'action_required' || o.status === 'attention_needed').length,
    }),
    [orgs],
  );

  if (data.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-8">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Commercial</p>
            <h1 className="text-2xl font-bold sm:text-3xl">Executive Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Visits, water chemistry, equipment and follow-ups for every commercial account.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={data.reload}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/admin/commercial">Manage accounts</Link>
            </Button>
          </div>
        </header>

        {data.error && (
          <Card className="mb-4 border-destructive/40">
            <CardContent className="p-4 text-sm text-destructive">{data.error}</CardContent>
          </Card>
        )}

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Organizations', value: totals.orgs, icon: Building2 },
            { label: 'Pools', value: totals.pools, icon: Droplets },
            { label: 'Visits (30d)', value: totals.visits30, icon: CalendarClock },
            { label: 'Open issues', value: totals.issues, icon: Wrench },
            { label: 'Open follow-ups', value: totals.followUps, icon: CalendarClock },
            { label: 'Need attention', value: totals.needsAttention, icon: AlertTriangle },
          ].map((k) => (
            <Card key={k.label}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <k.icon className="h-3.5 w-3.5" />
                  {k.label}
                </div>
                <p className="mt-1 text-2xl font-bold">{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search organization, facility or pool"
          className="mb-4"
        />

        <div className="space-y-3">
          {filtered.map((o) => {
            const open = expanded[o.org.id];
            return (
              <Card key={o.org.id} className={cn(o.status === 'action_required' && 'border-destructive/40')}>
                <CardHeader className="pb-2">
                  <button
                    className="flex w-full items-start justify-between gap-3 text-left"
                    onClick={() => setExpanded((s) => ({ ...s, [o.org.id]: !s[o.org.id] }))}
                  >
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="truncate">{o.org.name}</span>
                      </CardTitle>
                      <p className="mt-1 pl-6 text-xs text-muted-foreground">
                        {o.facilities.length} facilit{o.facilities.length === 1 ? 'y' : 'ies'} · {o.pools.length} pools ·
                        last visit {formatDate(o.lastVisit)}
                      </p>
                    </div>
                    <StatusBadge status={o.status} size="sm" />
                  </button>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-md border bg-background p-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Visits (30d)</p>
                      <p className="text-lg font-semibold">{o.visits30}</p>
                    </div>
                    <div className="rounded-md border bg-background p-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Chemistry</p>
                      <StatusBadge status={o.chemistry} size="sm" className="mt-1" />
                    </div>
                    <div className="rounded-md border bg-background p-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Equipment</p>
                      <StatusBadge status={o.equipmentStatus} size="sm" className="mt-1" />
                    </div>
                    <div className="rounded-md border bg-background p-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Follow-ups</p>
                      <p className="text-lg font-semibold">{o.followUps.length}</p>
                    </div>
                  </div>

                  {open && (
                    <div className="space-y-4 pt-1">
                      {/* Pools + chemistry */}
                      <section className="space-y-2">
                        <h3 className="text-sm font-semibold">Pools & latest chemistry</h3>
                        {o.pools.length === 0 && (
                          <p className="text-sm text-muted-foreground">No active pools linked yet.</p>
                        )}
                        {o.pools.map((p) => (
                          <div key={p.id} className="rounded-md border bg-background p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate font-medium">{p.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {p.facilityName} · {p.visits30} visit{p.visits30 === 1 ? '' : 's'} in 30 days · last{' '}
                                  {formatDate(p.lastService?.performed_at ?? null)}
                                  {p.lastService?.performed_at
                                    ? ` (${daysSince(p.lastService.performed_at)} days ago)`
                                    : ''}
                                </p>
                              </div>
                              <StatusBadge status={p.chemistry} size="sm" />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {CHEM_RANGES.map((r) => {
                                const v = p.readings[r.key];
                                if (v === null || v === undefined) return null;
                                const st = chemStatus(r, v);
                                return (
                                  <span
                                    key={r.key}
                                    className={cn(
                                      'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                      st === 'normal'
                                        ? 'bg-muted text-muted-foreground'
                                        : st === 'monitor'
                                          ? 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-400'
                                          : st === 'attention_needed'
                                            ? 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400'
                                            : 'bg-destructive/10 text-destructive border-destructive/30',
                                    )}
                                  >
                                    {r.label} {v.toFixed(r.decimals)}
                                    {r.unit ? ` ${r.unit}` : ''}
                                  </span>
                                );
                              })}
                              {!p.lastService && (
                                <span className="text-xs text-muted-foreground">No service logged yet.</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </section>

                      {/* Equipment attention */}
                      <section className="space-y-2">
                        <h3 className="text-sm font-semibold">Equipment needing attention</h3>
                        {o.equipment.filter((e) => e.status !== 'normal').length === 0 ? (
                          <p className="text-sm text-muted-foreground">All equipment reporting normal.</p>
                        ) : (
                          o.equipment
                            .filter((e) => e.status !== 'normal')
                            .map((e) => (
                              <div
                                key={e.id}
                                className="flex items-center justify-between gap-2 rounded-md border bg-background p-2 text-sm"
                              >
                                <span className="truncate">
                                  {e.name}
                                  {e.manufacturer ? ` · ${e.manufacturer}` : ''}
                                </span>
                                <StatusBadge status={e.status as CommercialStatus} size="sm" />
                              </div>
                            ))
                        )}
                      </section>

                      {/* Open issues */}
                      <section className="space-y-2">
                        <h3 className="text-sm font-semibold">Open issues</h3>
                        {o.issues.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No open issues.</p>
                        ) : (
                          o.issues.map((i) => (
                            <div key={i.id} className="rounded-md border bg-background p-2 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-medium">{i.title}</span>
                                <StatusBadge status={i.severity as CommercialStatus} size="sm" />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Opened {formatDate(i.opened_at)} · {i.status.replace(/_/g, ' ')}
                              </p>
                            </div>
                          ))
                        )}
                      </section>

                      {/* Follow-ups */}
                      <section className="space-y-2">
                        <h3 className="text-sm font-semibold">Scheduled follow-ups</h3>
                        {o.followUps.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
                        ) : (
                          o.followUps.map((f) => (
                            <div key={f.id} className="rounded-md border bg-background p-2 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-medium">{f.reason}</span>
                                <span className="text-xs text-muted-foreground">{formatDate(f.scheduled_date)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {f.status.replace(/_/g, ' ')}
                                {f.assigned_technician_id
                                  ? ` · ${data.technicianNames[f.assigned_technician_id] ?? 'Technician'}`
                                  : ''}
                              </p>
                            </div>
                          ))
                        )}
                      </section>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {filtered.length === 0 && (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No commercial organizations match that search.
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default CommercialExecutive;
