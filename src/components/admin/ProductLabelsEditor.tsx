import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { labelError, strengthText, useProductLabels, type ProductLabel, type PoolSuitability } from '@/lib/product-labels';
import { Plus, Tag } from 'lucide-react';

type Draft = Omit<ProductLabel, 'id' | 'verified_at'> & { id?: string; verified_at?: string | null };

const blank = (slug: string): Draft => ({
  catalog_slug: slug, product_name: '', manufacturer: '', active_ingredient: '', strength_min_pct: null, strength_max_pct: null,
  form: '', container_size: '', pool_suitability: 'not_verified', suitability_source: '', label_notes: '', is_preferred: false, active: true,
});

const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));
const SUIT_LABEL: Record<PoolSuitability, string> = { verified: 'Pool use verified', not_verified: 'Not verified', not_suitable: 'Not for pools' };

export function ProductLabelsEditor({ slug }: { slug: string }) {
  const { data: labels = [] } = useProductLabels(slug);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!edit) return;
    const err = labelError(edit);
    if (err) { toast({ title: 'Check the label', description: err, variant: 'destructive' }); return; }
    setSaving(true);
    const { id, verified_at, ...payload } = edit as any;
    const res = id
      ? await supabase.from('chemical_product_labels' as any).update(payload).eq('id', id)
      : await supabase.from('chemical_product_labels' as any).insert(payload);
    setSaving(false);
    if (res.error) { toast({ title: 'Could not save', description: res.error.message, variant: 'destructive' }); return; }
    setEdit(null);
    qc.invalidateQueries({ queryKey: ['product-labels'] });
    toast({ title: 'Product label saved' });
  };

  const set = (p: Partial<Draft>) => setEdit(e => (e ? { ...e, ...p } : e));

  return (
    <div className="space-y-2 rounded-md border border-dashed p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-sm font-medium"><Tag className="h-4 w-4" /> Product labels</p>
        {!edit && <Button size="sm" variant="outline" onClick={() => setEdit(blank(slug))}><Plus className="mr-1 h-3 w-3" />Add product</Button>}
      </div>
      {labels.length === 0 && !edit && <p className="text-xs text-muted-foreground">No products saved. Dose advice will use general estimates.</p>}
      {labels.map(l => (
        <button key={l.id} type="button" onClick={() => setEdit({ ...l })}
          className="flex w-full flex-wrap items-center gap-2 rounded border p-2 text-left text-sm hover:bg-muted">
          <span className="font-medium">{l.product_name}</span>
          <span className="text-xs text-muted-foreground">{l.manufacturer} · {strengthText(l)}{l.container_size ? ` · ${l.container_size}` : ''}</span>
          {l.is_preferred && <Badge variant="secondary">Preferred</Badge>}
          <Badge variant={l.pool_suitability === 'verified' ? 'default' : l.pool_suitability === 'not_suitable' ? 'destructive' : 'outline'}>
            {SUIT_LABEL[l.pool_suitability]}{l.verified_at ? ` ${new Date(l.verified_at).toLocaleDateString()}` : ''}
          </Badge>
          {!l.active && <Badge variant="outline">Hidden</Badge>}
        </button>
      ))}
      {edit && (
        <div className="grid grid-cols-2 gap-2 rounded border p-2">
          <div className="col-span-2 sm:col-span-1"><Label className="text-xs">Product name (as on label)</Label>
            <Input value={edit.product_name} onChange={e => set({ product_name: e.target.value })} /></div>
          <div className="col-span-2 sm:col-span-1"><Label className="text-xs">Manufacturer</Label>
            <Input value={edit.manufacturer ?? ''} onChange={e => set({ manufacturer: e.target.value })} /></div>
          <div className="col-span-2 sm:col-span-1"><Label className="text-xs">Active ingredient</Label>
            <Input value={edit.active_ingredient ?? ''} onChange={e => set({ active_ingredient: e.target.value })} /></div>
          <div className="col-span-1"><Label className="text-xs">Strength min %</Label>
            <Input type="number" inputMode="decimal" step="any" value={edit.strength_min_pct ?? ''} onChange={e => set({ strength_min_pct: numOrNull(e.target.value) })} /></div>
          <div className="col-span-1"><Label className="text-xs">Strength max %</Label>
            <Input type="number" inputMode="decimal" step="any" value={edit.strength_max_pct ?? ''} onChange={e => set({ strength_max_pct: numOrNull(e.target.value) })} /></div>
          <div className="col-span-1"><Label className="text-xs">Form</Label>
            <Input value={edit.form ?? ''} placeholder="flake, liquid, granular" onChange={e => set({ form: e.target.value })} /></div>
          <div className="col-span-1"><Label className="text-xs">Container size</Label>
            <Input value={edit.container_size ?? ''} placeholder="50 lb" onChange={e => set({ container_size: e.target.value })} /></div>
          <div className="col-span-2 sm:col-span-1"><Label className="text-xs">Pool suitability</Label>
            <Select value={edit.pool_suitability} onValueChange={v => set({ pool_suitability: v as PoolSuitability })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not_verified">Not verified</SelectItem>
                <SelectItem value="verified">Verified for pool use</SelectItem>
                <SelectItem value="not_suitable">Not suitable for pools</SelectItem>
              </SelectContent>
            </Select></div>
          <div className="col-span-2 sm:col-span-1"><Label className="text-xs">Confirmed from</Label>
            <Input value={edit.suitability_source ?? ''} placeholder="Bag label, SDS, manufacturer call" onChange={e => set({ suitability_source: e.target.value })} /></div>
          <div className="col-span-2"><Label className="text-xs">Label notes / warnings</Label>
            <Textarea rows={2} value={edit.label_notes ?? ''} onChange={e => set({ label_notes: e.target.value })} /></div>
          <label className="col-span-1 flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.is_preferred} onChange={e => set({ is_preferred: e.target.checked })} />Preferred</label>
          <label className="col-span-1 flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active} onChange={e => set({ active: e.target.checked })} />Active</label>
          <p className="col-span-2 text-xs text-muted-foreground">Enter the strength exactly as printed. If the label gives a range, enter both ends — doses will show a range, never a guess.</p>
          <div className="col-span-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save label'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
