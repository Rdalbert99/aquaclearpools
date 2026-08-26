import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import { FacilityScope } from './types';
import {
  CommercialStatus,
  daysSince,
  formatDate,
  formatDateTime,
  ISSUE_STATUS_LABEL,
  IssueStatus,
} from '@/lib/commercial';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  scope: FacilityScope;
}

export const IssuesPanel = ({ scope }: Props) => {
  const [showClosed, setShowClosed] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const issues = scope.issues.filter((i) => (showClosed ? true : i.status !== 'completed'));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {scope.issues.filter((i) => i.status !== 'completed').length} open · {scope.issues.filter((i) => i.status === 'completed').length} closed
        </p>
        <Button size="sm" variant="outline" onClick={() => setShowClosed((v) => !v)}>
          {showClosed ? 'Hide completed' : 'Show completed'}
        </Button>
      </div>

      {issues.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No equipment issues on record. </CardContent></Card>
      )}

      {issues.map((issue) => {
        const events = scope.issueEvents.filter((e) => e.issue_id === issue.id);
        const open = issue.status !== 'completed';
        const age = daysSince(issue.opened_at);
        const equipment = scope.equipment.find((e) => e.id === issue.equipment_id);
        const isOpen = expanded === issue.id;
        return (
          <Card key={issue.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{issue.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {equipment ? `${equipment.name} · ` : ''}Opened {formatDate(issue.opened_at)}
                    {open && age !== null ? ` · open ${age} day${age === 1 ? '' : 's'}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={issue.severity as CommercialStatus} size="sm" />
                  <Badge variant={open ? 'default' : 'secondary'}>
                    {ISSUE_STATUS_LABEL[issue.status as IssueStatus] ?? issue.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {issue.description && <p className="text-sm whitespace-pre-wrap">{issue.description}</p>}
              {issue.warranty_claim_reference && (
                <p className="text-xs text-muted-foreground">Warranty claim #{issue.warranty_claim_reference}</p>
              )}

              <Button variant="ghost" size="sm" className="px-0" onClick={() => setExpanded(isOpen ? null : issue.id)}>
                {isOpen ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
                {events.length} history entr{events.length === 1 ? 'y' : 'ies'}
              </Button>

              {isOpen && (
                <ol className="space-y-3 border-l pl-4">
                  {events.map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                      <p className="text-sm font-medium">
                        {e.status ? ISSUE_STATUS_LABEL[e.status as IssueStatus] ?? e.status : 'Update'}
                      </p>
                      {e.note && <p className="text-sm text-muted-foreground">{e.note}</p>}
                      <p className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</p>
                    </li>
                  ))}
                  {events.length === 0 && <li className="text-sm text-muted-foreground">No history recorded.</li>}
                </ol>
              )}

              {issue.closed_at && (
                <p className="text-xs text-muted-foreground">Completed {formatDateTime(issue.closed_at)}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
