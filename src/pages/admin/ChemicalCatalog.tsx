import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Save, Trash2, FlaskConical } from 'lucide-react';

interface Row {
  id?: string;
  slug: string;
  label: string;
  units: string[]; // text[]
  purpose: string;
  sort_order: number;
  active: boolean;
  is_other: boolean;
  _dirty?: boolean;
  _new?: boolean;
}

const ALL_UNITS = ['lbs', 'oz', 'gal', 'qt'] as const;

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export default function ChemicalCatalog() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chemical_catalog' as any)
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setRows((data as unknown as Row[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = (i: number, patch: Partial<Row>) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch, _dirty: true } : r));
  };

  const toggleUnit = (i: number, unit: string) => {
    const r = rows[i];
    const has = r.units.includes(unit);
    const units = has ? r.units.filter(u => u !== unit) : [...r.units, unit];
    if (!units.length) return; // require at least one
    update(i, { units });
  };

  const addRow = () => {
    setRows(prev => [
      ...prev,
      {
        slug: '',
        label: '',
        units: ['lbs'],
        purpose: '',
        sort_order: (prev.length ? Math.max(...prev.map(r => r.sort_order)) : 0) + 10,
        active: true,
        is_other: false,
        _new: true,
        _dirty: true,
      },
    ]);
  };

  const removeRow = async (i: number) => {
    const r = rows[i];
    if (r.is_other) {
      toast({ title: 'Cannot delete', description: 'The "Other" entry is required.', variant: 'destructive' });
      return;
    }
    if (r._new || !r.id) {
      setRows(prev => prev.filter((_, idx) => idx !== i));
      return;
    }
    if (!confirm(`Delete "${r.label}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('chemical_catalog' as any).delete().eq('id', r.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setRows(prev => prev.filter((_, idx) => idx !== i));
    qc.invalidateQueries({ queryKey: ['chemical-catalog'] });
    toast({ title: 'Deleted', description: `${r.label} removed.` });
  };

  const saveAll = async () => {
    const dirty = rows.filter(r => r._dirty);
    if (!dirty.length) {
      toast({ title: 'Nothing to save' });
      return;
    }
    // Validate
    for (const r of dirty) {
      if (!r.label.trim()) {
        toast({ title: 'Missing label', description: 'Every chemical needs a name.', variant: 'destructive' });
        return;
      }
      if (!r.units.length) {
        toast({ title: 'Missing unit', description: `Add at least one unit for ${r.label}.`, variant: 'destructive' });
        return;
      }
    }

    setSaving(true);
    try {
      for (const r of dirty) {
        const slug = r.slug?.trim() || slugify(r.label);
        const payload = {
          slug,
          label: r.label.trim(),
          units: r.units,
          purpose: r.purpose ?? '',
          sort_order: Number(r.sort_order) || 0,
          active: r.active,
          is_other: r.is_other,
        };
        if (r._new) {
          const { error } = await supabase.from('chemical_catalog' as any).insert(payload);
          if (error) throw error;
        } else if (r.id) {
          const { error } = await supabase.from('chemical_catalog' as any).update(payload).eq('id', r.id);
          if (error) throw error;
        }
      }
      toast({ title: 'Saved', description: 'Chemical catalog updated.' });
      qc.invalidateQueries({ queryKey: ['chemical-catalog'] });
      await load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FlaskConical className="h-7 w-7" /> Chemical Catalog
            </h1>
            <p className="text-muted-foreground">
              Edit the chemical names, default units, and customer-facing explanations used on every service log.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addRow}>
            <Plus className="h-4 w-4 mr-2" /> Add chemical
          </Button>
          <Button onClick={saveAll} disabled={saving || loading}>
            {saving ? <LoadingSpinner /> : (<><Save className="h-4 w-4 mr-2" /> Save changes</>)}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <Card key={r.id ?? `new-${i}`} className={r._dirty ? 'border-primary' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-base">
                      {r.label || <span className="italic text-muted-foreground">New chemical</span>}
                      {r.is_other && <span className="ml-2 text-xs text-muted-foreground">(reserved)</span>}
                      {!r.active && <span className="ml-2 text-xs text-amber-600">hidden</span>}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Slug: <code>{r.slug || slugify(r.label) || '—'}</code>
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(i)}
                    disabled={r.is_other}
                    aria-label="Delete chemical"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12 sm:col-span-6">
                    <Label className="text-xs">Name shown to tech</Label>
                    <Input value={r.label} onChange={e => update(i, { label: e.target.value })} />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <Label className="text-xs">Sort order</Label>
                    <Input
                      type="number"
                      value={r.sort_order}
                      onChange={e => update(i, { sort_order: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3 flex items-end gap-2">
                    <Checkbox
                      id={`active-${i}`}
                      checked={r.active}
                      onCheckedChange={v => update(i, { active: !!v })}
                    />
                    <Label htmlFor={`active-${i}`}>Active</Label>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Units available (first is the default)</Label>
                  <div className="flex flex-wrap gap-3 mt-1">
                    {ALL_UNITS.map(u => (
                      <label key={u} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={r.units.includes(u)}
                          onCheckedChange={() => toggleUnit(i, u)}
                        />
                        {u}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs">What it's for (shown in the customer SMS)</Label>
                  <Textarea
                    rows={2}
                    value={r.purpose}
                    onChange={e => update(i, { purpose: e.target.value })}
                    placeholder='e.g. "to raise total alkalinity"'
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Customer sees: <em>"2 lbs {r.label || 'Chemical'} — {r.purpose || '…'}"</em>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
