import { ArrowLeft, MapPin, Timer, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { HealthResult } from '@/lib/pool-health';

export type VisitStatus = 'scheduled' | 'on_my_way' | 'in_progress' | 'complete';

const STATUS_META: Record<VisitStatus, { label: string; className: string }> = {
  scheduled: { label: 'Scheduled', className: 'bg-muted text-muted-foreground border-border' },
  on_my_way: { label: 'On My Way', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40' },
  in_progress: { label: 'In Progress', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40' },
  complete: { label: 'Complete', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40' },
};

interface Props {
  customerName: string;
  address?: string | null;
  mapsHref?: string | null;
  status: VisitStatus;
  technicianName?: string | null;
  technicianLocked?: boolean;
  elapsedLabel: string | null;
  health: HealthResult;
  onBack: () => void;
}

export function ServiceStickyHeader({
  customerName, address, mapsHref, status, technicianName, technicianLocked, elapsedLabel, health, onBack,
}: Props) {
  const statusMeta = STATUS_META[status];
  return (
    <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 mb-4 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight sm:text-xl">{customerName}</h1>
          {address && (
            <a
              href={mapsHref ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline sm:text-sm"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{address}</span>
            </a>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <Badge variant="outline" className={cn('font-medium', statusMeta.className)}>{statusMeta.label}</Badge>
            {technicianName && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                {technicianName}{technicianLocked ? ' (locked)' : ''}
              </span>
            )}
            {elapsedLabel && (
              <span className="inline-flex items-center gap-1 font-mono font-medium tabular-nums">
                <Timer className="h-3.5 w-3.5" />
                {elapsedLabel}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-center">
          <div
            className={cn(
              'flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 sm:h-16 sm:w-16',
              health.badgeClass,
            )}
            title={health.reasons.join(' · ') || 'No issues detected'}
          >
            <span className="text-lg font-bold leading-none sm:text-xl">{health.score}</span>
            <span className="text-[9px] uppercase tracking-wide opacity-80">health</span>
          </div>
          <p className={cn('mt-1 text-[10px] font-medium', health.color)}>{health.label}</p>
        </div>
      </div>
    </div>
  );
}
