import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from './StatusBadge';
import { FacilityScope, technicianName } from './types';
import {
  CHEM_RANGES,
  chemStatus,
  chemistryStatus,
  CommercialStatus,
  daysSince,
  formatDate,
  readingsFromService,
  worstStatus,
} from '@/lib/commercial';
import { CalendarClock, Droplets, Gauge, Wrench } from 'lucide-react';

interface Props {
  scope: FacilityScope;
  onNavigate: (tab: string) => void;
}

export const PortalDashboard = ({ scope, onNavigate }: Props) => {
  const openIssues = scope.issues.filter((i) => i.status !== 'completed');
  const equipmentAlerts = scope.equipment.filter((e) => e.status !== 'normal');

  const poolCards = scope.pools.map((pool) => {
    const services = scope.services
      .filter((s) => s.client_id === pool.client_id)
      .sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime());
    const latest = services[0] ?? null;
    const chem = chemistryStatus(latest);
    const overdue = daysSince(pool.client?.last_service_date ?? latest?.performed_at ?? null);
    const staleness: CommercialStatus =
      overdue === null ? 'monitor' : overdue > 14 ? 'attention_needed' : overdue > 9 ? 'monitor' : 'normal';
    const poolIssues = openIssues.filter((i) => i.pool_id === pool.id);
    const issueStatus: CommercialStatus = poolIssues.some((i) => i.severity === 'action_required')
      ? 'action_required'
      : poolIssues.length
        ? 'attention_needed'
        : 'normal';

    return {
      pool,
      latest,
      overall: worstStatus(chem, staleness, issueStatus),
      readings: latest ? readingsFromService(latest) : {},
      openIssueCount: poolIssues.length,
    };
  });

  const overall = worstStatus(
    ...poolCards.map((p) => p.overall),
    ...(equipmentAlerts.length ? (['attention_needed'] as CommercialStatus[]) : []),
  );

  const nextService = scope.pools
    .map((p) => p.client?.next_service_date)
    .filter((d): d is string => !!d)
    .sort()[0];

  const lastService = scope.services[0]?.performed_at ?? null;

  return (
    <div className="space-y-4">
      {/* IS THE POOL OK? */}
      <Card className="border-2">
        <CardContent className="p-5 sm:p-7 text-center space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Is the pool OK?
          </p>
          <div className="flex justify-center">
            <StatusBadge status={overall} size="lg" />
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {overall === 'normal' && 'All monitored pools are within operating range with no open equipment issues.'}
            {overall === 'monitor' && 'Everything is safe to operate, but one or more readings are drifting from ideal.'}
            {overall === 'attention_needed' && 'One or more pools or systems need corrective action on the next visit.'}
            {overall === 'action_required' && 'Immediate action is recommended. Contact Aqua Clear before bather use.'}
          </p>
        </CardContent>
      </Card>

      {/* Key facts */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile icon={Droplets} label="Last Service" value={formatDate(lastService)} onClick={() => onNavigate('history')} />
        <SummaryTile icon={CalendarClock} label="Next Scheduled" value={formatDate(nextService)} />
        <SummaryTile icon={Wrench} label="Open Issues" value={String(openIssues.length)} onClick={() => onNavigate('issues')} />
        <SummaryTile icon={Gauge} label="Equipment Alerts" value={String(equipmentAlerts.length)} onClick={() => onNavigate('equipment')} />
      </div>

      {/* Per pool */}
      <div className="space-y-3">
        {poolCards.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No pools are configured for this facility yet.</CardContent></Card>
        )}
        {poolCards.map(({ pool, latest, overall: poolStatus, readings, openIssueCount }) => (
          <Card key={pool.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{pool.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {[pool.pool_use, pool.pool_type, pool.pool_size ? `${pool.pool_size.toLocaleString()} gal` : null]
                      .filter(Boolean)
                      .join(' · ') || 'Commercial pool'}
                  </p>
                </div>
                <StatusBadge status={poolStatus} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {CHEM_RANGES.map((range) => {
                  const value = readings[range.key];
                  if (value === null || value === undefined) return null;
                  const status = chemStatus(range, value);
                  return (
                    <div key={range.key} className="rounded-lg border p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{range.label}</p>
                      <p className="text-lg font-semibold leading-tight">{value.toFixed(range.decimals)}</p>
                      <StatusBadge status={status} size="sm" className="mt-1" />
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">Last visit {formatDate(latest?.performed_at)}</Badge>
                {latest?.technician_id && <Badge variant="secondary">Tech: {technicianName(scope, latest.technician_id)}</Badge>}
                {openIssueCount > 0 && <Badge variant="destructive">{openIssueCount} open issue{openIssueCount > 1 ? 's' : ''}</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

const SummaryTile = ({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: typeof Droplets;
  label: string;
  value: string;
  onClick?: () => void;
}) => (
  <Card onClick={onClick} className={onClick ? 'cursor-pointer transition-colors hover:bg-accent' : undefined}>
    <CardContent className="p-3 sm:p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-base font-semibold sm:text-lg">{value}</p>
    </CardContent>
  </Card>
);
