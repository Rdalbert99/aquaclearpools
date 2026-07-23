import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { CHEMICAL_OPTIONS } from '@/lib/chemicals-added';
import { CHEMICAL_BASE_UNIT } from '@/lib/inventory-cost';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

type Row = { chemical_id: string; unit: 'lbs' | 'gal'; unit_cost: string };

export default function ChemicalBaseCosts() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('chemical_base_costs' as any).select('*');
      const map: Record<string, Row> = {};
      for (const opt of CHEMICAL_OPTIONS.filter(o => o.id !== 'other')) {
        const unit = (CHEMICAL_BASE_UNIT[opt.id] ?? 'lbs') as 'lbs' | 'gal';
        map[opt.id] = { chemical_id: opt.id, unit, unit_cost: '' };
      }
      for (const r of (data as any[]) || []) {
        map[r.chemical_id] = {
          chemical_id: r.chemical_id,
          unit: r.unit,
          unit_cost: String(r.unit_cost ?? ''),
        };
      }
      setRows(map);
      setLoading(false);
    })();
  }, []);

  const update = (id: string, cost: string) =>
    setRows(prev => ({ ...prev, [id]: { ...prev[id], unit_cost: cost } }));

  const save = async () => {
    setSaving(true);
    const payload = Object.values(rows)
      .filter(r => r.unit_cost !== '' && !isNaN(Number(r.unit_cost)))
      .map(r => ({
        chemical_id: r.chemical_id,
        unit: r.unit,
        unit_cost: Number(r.unit_cost),
        updated_by: user?.id ?? null,
      }));
    const { error } = await supabase
      .from('chemical_base_costs' as any)
      .upsert(payload, { onConflict: 'chemical_id' });
    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Base costs saved' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Base chemical costs</CardTitle>
        <p className="text-sm text-muted-foreground">
          Default price per unit for each chemical. Used to cost service calls when there's no purchase history for that chemical yet.
          Actual purchases still override with weighted-average pricing.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {CHEMICAL_OPTIONS.filter(o => o.id !== 'other').map(opt => {
              const r = rows[opt.id];
              return (
                <div key={opt.id} className="flex items-center gap-2">
                  <label className="flex-1 text-sm">{opt.label}</label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-24 h-8"
                      value={r?.unit_cost ?? ''}
                      onChange={e => update(opt.id, e.target.value)}
                      placeholder="0.00"
                    />
                    <span className="text-xs text-muted-foreground w-8">/{r?.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save base costs'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
