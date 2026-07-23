import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { CHEMICAL_OPTIONS } from '@/lib/chemicals-added';
import { CHEMICAL_BASE_UNIT, fmtMoney } from '@/lib/inventory-cost';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Trash2, AlertTriangle } from 'lucide-react';

const LOOKBACK_DAYS = 30;
const LOW_STOCK_DAYS = 14;

interface Purchase {
  id: string;
  chemical_id: string;
  chemical_label: string;
  unit: string;
  quantity: number;
  total_cost: number;
  unit_cost: number;
  purchased_at: string;
  notes: string | null;
}

interface Usage {
  chemical_id: string;
  quantity_used: number;
}

interface Usage {
  chemical_id: string;
  quantity_used: number;
}

interface RecentUsage {
  chemical_id: string;
  quantity_used: number;
  created_at: string;
}

export default function Inventory() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [recentDaily, setRecentDaily] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [chemicalId, setChemicalId] = useState('liquid_chlorine');
  const [quantity, setQuantity] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const currentBase = CHEMICAL_BASE_UNIT[chemicalId] ?? 'lbs';

  async function refresh() {
    setLoading(true);
    const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString();
    const [{ data: p }, { data: u }, { data: recent }] = await Promise.all([
      supabase.from('chemical_inventory_purchases').select('*').order('purchased_at', { ascending: false }),
      supabase.from('service_chemical_usage').select('chemical_id, quantity_used'),
      supabase.from('service_chemical_usage').select('chemical_id, quantity_used, created_at').gte('created_at', sinceIso),
    ]);
    setPurchases((p as any) ?? []);
    const usageAcc: Record<string, number> = {};
    ((u as Usage[]) ?? []).forEach(r => {
      usageAcc[r.chemical_id] = (usageAcc[r.chemical_id] ?? 0) + Number(r.quantity_used || 0);
    });
    setUsage(usageAcc);

    const recentAcc: Record<string, number> = {};
    ((recent as RecentUsage[]) ?? []).forEach(r => {
      recentAcc[r.chemical_id] = (recentAcc[r.chemical_id] ?? 0) + Number(r.quantity_used || 0);
    });
    const daily: Record<string, number> = {};
    Object.entries(recentAcc).forEach(([id, total]) => { daily[id] = total / LOOKBACK_DAYS; });
    setRecentDaily(daily);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function addPurchase() {
    const q = parseFloat(quantity);
    const c = parseFloat(totalCost);
    if (!(q > 0) || !(c >= 0)) {
      toast({ title: 'Invalid values', description: 'Enter a quantity and total cost.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const label = CHEMICAL_OPTIONS.find(o => o.id === chemicalId)?.label ?? chemicalId;
    const { error } = await supabase.from('chemical_inventory_purchases').insert({
      chemical_id: chemicalId,
      chemical_label: label,
      unit: currentBase,
      quantity: q,
      total_cost: c,
      notes: notes || null,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    setQuantity(''); setTotalCost(''); setNotes('');
    toast({ title: 'Purchase logged' });
    refresh();
  }

  async function removePurchase(id: string) {
    if (!confirm('Delete this purchase?')) return;
    const { error } = await supabase.from('chemical_inventory_purchases').delete().eq('id', id);
    if (error) { toast({ title: 'Delete failed', description: error.message, variant: 'destructive' }); return; }
    refresh();
  }

  // Summary per chemical: total purchased, total cost, weighted avg, on-hand
  const summary = new Map<string, { label: string; unit: string; qty: number; cost: number; used: number }>();
  purchases.forEach(p => {
    const s = summary.get(p.chemical_id) ?? { label: p.chemical_label, unit: p.unit, qty: 0, cost: 0, used: usage[p.chemical_id] ?? 0 };
    s.qty += Number(p.quantity);
    s.cost += Number(p.total_cost);
    summary.set(p.chemical_id, s);
  });

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Chemical Inventory</h1>
        <p className="text-muted-foreground text-sm">Log every chemical purchase. Costs feed each service call and per-client cost charts.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Log a purchase</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          <div className="sm:col-span-2">
            <Label>Chemical</Label>
            <Select value={chemicalId} onValueChange={setChemicalId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHEMICAL_OPTIONS.filter(o => o.id !== 'other').map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.label} ({CHEMICAL_BASE_UNIT[o.id] ?? 'lbs'})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantity ({currentBase})</Label>
            <Input type="number" step="0.01" min="0" value={quantity} onChange={e => setQuantity(e.target.value)} />
          </div>
          <div>
            <Label>Total cost ($)</Label>
            <Input type="number" step="0.01" min="0" value={totalCost} onChange={e => setTotalCost(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={addPurchase} disabled={saving} className="w-full">
              {saving ? 'Saving…' : 'Add purchase'}
            </Button>
          </div>
          <div className="sm:col-span-2 md:col-span-5">
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Supplier, invoice #, etc." />
          </div>
          {quantity && totalCost && parseFloat(quantity) > 0 && (
            <div className="sm:col-span-2 md:col-span-5 text-sm text-muted-foreground">
              Unit cost: <strong>{fmtMoney(parseFloat(totalCost) / parseFloat(quantity))}</strong> per {currentBase}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>On-hand summary</CardTitle></CardHeader>
        <CardContent>
          {summary.size === 0 ? (
            <div className="text-sm text-muted-foreground">No purchases logged yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chemical</TableHead>
                    <TableHead className="text-right">Purchased</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Avg unit cost</TableHead>
                    <TableHead className="text-right">Value on hand</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...summary.entries()].map(([id, s]) => {
                    const avg = s.qty > 0 ? s.cost / s.qty : 0;
                    const onHand = s.qty - s.used;
                    return (
                      <TableRow key={id}>
                        <TableCell className="font-medium">{s.label}</TableCell>
                        <TableCell className="text-right">{s.qty.toFixed(2)} {s.unit}</TableCell>
                        <TableCell className="text-right">{s.used.toFixed(2)} {s.unit}</TableCell>
                        <TableCell className="text-right">{onHand.toFixed(2)} {s.unit}</TableCell>
                        <TableCell className="text-right">{fmtMoney(avg)}/{s.unit}</TableCell>
                        <TableCell className="text-right">{fmtMoney(Math.max(0, onHand) * avg)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Purchase history</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : purchases.length === 0 ? (
            <div className="text-sm text-muted-foreground">No purchases yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Chemical</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Unit cost</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.purchased_at).toLocaleDateString()}</TableCell>
                      <TableCell>{p.chemical_label}</TableCell>
                      <TableCell className="text-right">{Number(p.quantity).toFixed(2)} {p.unit}</TableCell>
                      <TableCell className="text-right">{fmtMoney(Number(p.total_cost))}</TableCell>
                      <TableCell className="text-right">{fmtMoney(Number(p.unit_cost))}/{p.unit}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">{p.notes ?? ''}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removePurchase(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
