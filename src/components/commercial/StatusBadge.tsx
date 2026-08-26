import { cn } from '@/lib/utils';
import { CommercialStatus, STATUS_CLASS, STATUS_LABEL } from '@/lib/commercial';
import { AlertTriangle, CheckCircle2, Eye, OctagonAlert } from 'lucide-react';

const ICONS: Record<CommercialStatus, typeof CheckCircle2> = {
  normal: CheckCircle2,
  monitor: Eye,
  attention_needed: AlertTriangle,
  action_required: OctagonAlert,
};

interface Props {
  status: CommercialStatus;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge = ({ status, className, size = 'md' }: Props) => {
  const Icon = ICONS[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-wide',
        STATUS_CLASS[status],
        size === 'sm' && 'px-2 py-0.5 text-[10px]',
        size === 'md' && 'px-2.5 py-1 text-xs',
        size === 'lg' && 'px-4 py-2 text-sm',
        className,
      )}
    >
      <Icon className={cn(size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5')} />
      {STATUS_LABEL[status]}
    </span>
  );
};
