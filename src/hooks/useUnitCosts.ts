import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { UnitCostMap } from '@/lib/inventory-cost';

/**
 * Weighted-average unit cost per chemical, computed across all purchases.
 * total_cost sum / quantity sum, per chemical_id. Storage unit is 'lbs' or 'gal'.
 */
export function useUnitCosts() {
  const [costs, setCosts] = useState<UnitCostMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('chemical_inventory_purchases')
        .select('chemical_id, unit, quantity, total_cost');
      if (cancelled) return;
      if (error || !data) {
        setCosts({});
        setLoading(false);
        return;
      }
      const acc: Record<string, { qty: number; cost: number; unit: 'lbs' | 'gal' }> = {};
      for (const row of data as any[]) {
        const id = row.chemical_id as string;
        const unit = (row.unit === 'gal' ? 'gal' : 'lbs') as 'lbs' | 'gal';
        const q = Number(row.quantity) || 0;
        const c = Number(row.total_cost) || 0;
        if (q <= 0) continue;
        if (!acc[id]) acc[id] = { qty: 0, cost: 0, unit };
        acc[id].qty += q;
        acc[id].cost += c;
        acc[id].unit = unit;
      }
      const out: UnitCostMap = {};
      Object.entries(acc).forEach(([id, v]) => {
        out[id] = { unitCost: v.qty > 0 ? v.cost / v.qty : 0, unit: v.unit };
      });
      setCosts(out);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { costs, loading };
}
