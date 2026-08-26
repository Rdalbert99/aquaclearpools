import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from './StatusBadge';
import { FacilityScope } from './types';
import { CommercialStatus, equipmentStatus, formatDate, ISSUE_STATUS_LABEL, IssueStatus } from '@/lib/commercial';

interface Props {
  scope: FacilityScope;
}

export const EquipmentPanel = ({ scope }: Props) => {
  if (scope.equipment.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">No equipment has been catalogued for this facility yet.</CardContent></Card>;
  }

  return (
    <div className="space-y-3">
      {scope.equipment.map((eq) => {
        const status = equipmentStatus(eq.warranty_expiration, eq.status as CommercialStatus);
        const related = scope.issues.filter((i) => i.equipment_id === eq.id);
        const pool = scope.pools.find((p) => p.id === eq.pool_id);
        const underWarranty = eq.warranty_expiration ? new Date(eq.warranty_expiration) > new Date() : null;
        return (
          <Card key={eq.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{eq.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {[eq.category, pool?.name].filter(Boolean).join(' · ') || 'Facility equipment'}
                  </p>
                </div>
                <StatusBadge status={status} size="sm" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                <Field label="Manufacturer" value={eq.manufacturer} />
                <Field label="Model" value={eq.model} />
                <Field label="Serial number" value={eq.serial_number} />
                <Field label="Installed" value={formatDate(eq.installation_date)} />
                <Field label="Warranty ends" value={formatDate(eq.warranty_expiration)} />
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Warranty</dt>
                  <dd>
                    {underWarranty === null ? (
                      <span className="text-muted-foreground">Not recorded</span>
                    ) : (
                      <Badge variant={underWarranty ? 'secondary' : 'outline'}>
                        {underWarranty ? 'Active' : 'Expired'}
                      </Badge>
                    )}
                  </dd>
                </div>
              </dl>

              {eq.photo_urls?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {eq.photo_urls.map((url) => (
                    <img key={url} src={url} alt={`${eq.name} equipment`} loading="lazy" className="h-24 w-32 flex-shrink-0 rounded-md object-cover" />
                  ))}
                </div>
              )}

              {eq.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{eq.notes}</p>}

              {related.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Service history</p>
                  <ul className="space-y-1 text-sm">
                    {related.map((i) => (
                      <li key={i.id} className="flex flex-wrap items-center gap-2">
                        <span>{formatDate(i.opened_at)}</span>
                        <span className="text-muted-foreground">{i.title}</span>
                        <Badge variant="outline">{ISSUE_STATUS_LABEL[i.status as IssueStatus] ?? i.status}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: string | null }) => (
  <div>
    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className="font-medium">{value || <span className="font-normal text-muted-foreground">—</span>}</dd>
  </div>
);
