import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from './StatusBadge';
import { FacilityScope, technicianName } from './types';
import { CHEM_RANGES, chemStatus, chemistryStatus, formatDateTime, readingsFromService } from '@/lib/commercial';

interface Props {
  scope: FacilityScope;
}

/**
 * Reads the EXISTING services table. No commercial-only visit records exist.
 */
export const ServiceHistoryPanel = ({ scope }: Props) => {
  const [poolFilter, setPoolFilter] = useState('all');

  const services = useMemo(() => {
    const list = poolFilter === 'all'
      ? scope.services
      : scope.services.filter((s) => s.client_id === scope.pools.find((p) => p.id === poolFilter)?.client_id);
    return [...list].sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime());
  }, [scope, poolFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{services.length} service visits on record</p>
        <Select value={poolFilter} onValueChange={setPoolFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All pools</SelectItem>
            {scope.pools.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {services.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No service visits recorded yet.</CardContent></Card>
      )}

      <Accordion type="single" collapsible className="space-y-2">
        {services.map((service) => {
          const readings = readingsFromService(service);
          const usage = scope.chemUsage.filter((u) => u.service_id === service.id);
          return (
            <AccordionItem key={service.id} value={service.id} className="rounded-lg border px-3">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex w-full flex-col items-start gap-1 pr-2 text-left">
                  <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{formatDateTime(service.performed_at)}</span>
                    <StatusBadge status={chemistryStatus(service)} size="sm" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {technicianName(scope, service.technician_id)}
                    {service.duration_minutes ? ` · ${service.duration_minutes} min` : ''}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {CHEM_RANGES.map((range) => {
                    const value = readings[range.key];
                    if (value === null || value === undefined) return null;
                    return (
                      <div key={range.key} className="rounded-md border p-2">
                        <p className="text-[10px] uppercase text-muted-foreground">{range.label}</p>
                        <p className="text-sm font-semibold">{value.toFixed(range.decimals)} {range.unit}</p>
                        <StatusBadge status={chemStatus(range, value)} size="sm" className="mt-1" />
                      </div>
                    );
                  })}
                </div>

                {usage.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chemicals added</p>
                    <div className="flex flex-wrap gap-1.5">
                      {usage.map((u) => (
                        <Badge key={u.id} variant="secondary">{u.chemical_label}: {u.quantity_used} {u.unit}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {service.services_performed && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Work performed</p>
                    <p className="text-sm">{service.services_performed}</p>
                  </div>
                )}
                {service.notes && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Technician notes</p>
                    <p className="text-sm whitespace-pre-wrap">{service.notes}</p>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};
