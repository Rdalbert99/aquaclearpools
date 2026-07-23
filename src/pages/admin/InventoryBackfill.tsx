import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useUnitCosts } from '@/hooks/useUnitCosts';
import { computeServiceCost, fmtMoney } from '@/lib/inventory-cost';
import { parseLegacyChemicalsNote } from '@/lib/backfill-chemicals';
import { CHEMICAL_OPTIONS } from '@/lib/chemicals-added';

interface ServiceRow {
  id: string;
  service_date: string | null;
  chemicals_added: string | null;
  client_id: string;
  clients?: { customer: string | null } | null;
}

interface PreviewRow {
  service: ServiceRow;
  parsed: ReturnType<typeof parseLegacyChemicalsNote>;
  lines: ReturnType<typeof computeServiceCost>['lines'];
  total: number;
}

function labelFor(id: string, other?: string) {
  if (id === 'other') return other || 'Other';
  return CHEMICAL_OPTIONS.find(c => c.id === id)?.label ?? id;
}

export default function InventoryBackfill() {
  const { costs, loading: costsLoading } = useUnitCosts();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [existingSet, setExistingSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState<{ updated: number; skipped: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: svc, error } = await supabase
        .from('services')
        .select('id, service_date, chemicals_added, client_id, clients(customer)')
        .not('chemicals_added', 'is', null)
        .or('chemicals_cost.is.null,chemicals_cost.eq.0')
        .order('service_date', { ascending: false })
        .limit(1000);
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      const rows = ((svc ?? []) as any[]).filter(r => (r.chemicals_added ?? '').trim().length > 0) as ServiceRow[];

      // Fetch which of these already have usage rows so we can skip them
      const ids = rows.map(r => r.id);
      let existing = new Set<string>();
      if (ids.length) {
        const { data: usage } = await supabase
          .from('service_chemical_usage')
          .select('service_id')
          .in('service_id', ids);
        existing = new Set(((usage ?? []) as any[]).map(u => u.service_id));
      }
      if (cancelled) return;
      setServices(rows);
      setExistingSet(existing);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const preview: PreviewRow[] = useMemo(() => {
    if (costsLoading) return [];
    return services.map(svc => {
      const parsed = parseLegacyChemicalsNote(svc.chemicals_added);
      const { lines, total } = computeServiceCost(parsed, labelFor, costs);
      return { service: svc, parsed, lines, total };
    });
  }, [services, costs, costsLoading]);

  const parsable = preview.filter(p => p.parsed.length > 0 && !existingSet.has(p.service.id));
  const unparsable = preview.filter(p => p.parsed.length === 0 && !existingSet.has(p.service.id));
  const alreadyDone = preview.filter(p => existingSet.has(p.service.id));

  const grandTotal = parsable.reduce((s, p) => s + p.total, 0);
  const withCost = parsable.filter(p => p.total > 0).length;
  const zeroCost = parsable.length - withCost;

  async function apply() {
    if (!parsable.length) return;
    setApplying(true);
    let updated = 0;
    let skipped = 0;
    try {
      for (const row of parsable) {
        // Skip if usage rows appeared for this service since we loaded
        const { count } = await supabase
          .from('service_chemical_usage')
          .select('id', { count: 'exact', head: true })
          .eq('service_id', row.service.id);
        if ((count ?? 0) > 0) { skipped++; continue; }

        if (row.lines.length) {
          const insertRows = row.lines.map(l => ({
            service_id: row.service.id,
            chemical_id: l.chemical_id,
            chemical_label: l.chemical_label,
            unit: l.unit,
            quantity_used: l.quantity_used,
            unit_cost_snapshot: l.unit_cost_snapshot,
            line_cost: l.line_cost,
          }));
          const { error: insErr } = await supabase.from('service_chemical_usage').insert(insertRows);
          if (insErr) { console.error(insErr); skipped++; continue; }
        }
        const { error: updErr } = await supabase
          .from('services')
          .update({ chemicals_cost: row.total })
          .eq('id', row.service.id);
        if (updErr) { console.error(updErr); skipped++; continue; }
        updated++;
      }
      setDone({ updated, skipped });
      toast.success(`Backfilled ${updated} service${updated === 1 ? '' : 's'}`);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/inventory"><ArrowLeft className="h-4 w-4 mr-1" />Back to Inventory</Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Backfill Service Costs</h1>
        <p className="text-muted-foreground text-sm">
          Parse legacy service notes and apply your current inventory unit costs so past months
          show a chemical spend. Only services with a chemicals note and no cost yet are shown.
        </p>
      </div>

      {loading || costsLoading ? (
        <p className="text-sm text-muted-foreground">Loading services…</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Services scanned</div>
                <div className="text-xl font-semibold">{services.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Parsable</div>
                <div className="text-xl font-semibold">{parsable.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Not recognized</div>
                <div className="text-xl font-semibold">{unparsable.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Estimated total spend</div>
                <div className="text-xl font-semibold">{fmtMoney(grandTotal)}</div>
              </div>
            </CardContent>
          </Card>

          {zeroCost > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{zeroCost} service{zeroCost === 1 ? '' : 's'} parsed but no price</AlertTitle>
              <AlertDescription>
                Those services use chemicals you haven't logged a purchase for yet. They'll be
                written with quantity but $0. Add purchases on the Inventory page and re-run to price them.
              </AlertDescription>
            </Alert>
          )}

          {done && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Backfill complete</AlertTitle>
              <AlertDescription>
                Updated {done.updated} service{done.updated === 1 ? '' : 's'}
                {done.skipped ? `, skipped ${done.skipped}` : ''}.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={apply} disabled={applying || parsable.length === 0}>
              {applying ? 'Applying…' : `Apply to ${parsable.length} service${parsable.length === 1 ? '' : 's'}`}
            </Button>
            {alreadyDone.length > 0 && (
              <span className="text-xs text-muted-foreground self-center">
                {alreadyDone.length} already have detailed cost rows and were skipped.
              </span>
            )}
          </div>

          {parsable.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preview — will be written</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {parsable.slice(0, 200).map(p => (
                  <div key={p.service.id} className="border rounded-md p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-medium">{p.service.clients?.customer ?? 'Client'}</span>
                        <span className="text-muted-foreground ml-2">
                          {p.service.service_date ? new Date(p.service.service_date).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <Badge variant={p.total > 0 ? 'default' : 'secondary'}>{fmtMoney(p.total)}</Badge>
                    </div>
                    <div className="text-muted-foreground italic text-xs mt-1">"{p.service.chemicals_added}"</div>
                    <div className="mt-2 space-y-1">
                      {p.lines.map((l, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{l.quantity_used.toFixed(2)} {l.unit} {l.chemical_label}</span>
                          <span className="text-muted-foreground">
                            {fmtMoney(l.unit_cost_snapshot)}/{l.unit} → {fmtMoney(l.line_cost)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {parsable.length > 200 && (
                  <p className="text-xs text-muted-foreground">Showing first 200 of {parsable.length}. All will be applied.</p>
                )}
              </CardContent>
            </Card>
          )}

          {unparsable.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Not recognized</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground text-xs">
                  These notes don't contain a chemical + amount the parser could read (e.g. "all clean and balanced").
                  They'll be left alone.
                </p>
                {unparsable.slice(0, 100).map(p => (
                  <div key={p.service.id} className="border rounded-md p-2">
                    <div className="text-xs text-muted-foreground">
                      {p.service.clients?.customer ?? 'Client'} • {p.service.service_date ? new Date(p.service.service_date).toLocaleDateString() : ''}
                    </div>
                    <div className="italic">"{p.service.chemicals_added}"</div>
                  </div>
                ))}
                {unparsable.length > 100 && (
                  <p className="text-xs text-muted-foreground">…and {unparsable.length - 100} more.</p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
