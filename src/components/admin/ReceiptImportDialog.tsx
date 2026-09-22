import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Upload, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { CHEMICAL_OPTIONS } from '@/lib/chemicals-added';
import { CHEMICAL_BASE_UNIT, fmtMoney } from '@/lib/inventory-cost';
import {
  type CatalogItem,
  type ParsedReceipt,
  type ReviewLine,
  baseQuantityFor,
  baseUnitForCatalogId,
  lineCostFor,
  slugify,
  toReviewLines,
} from '@/lib/receipt-import';

type Step = 'capture' | 'analyzing' | 'review' | 'saving';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

const MAX_EDGE = 1800;

async function fileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }
  // Downscale photos so large camera shots upload and analyze quickly.
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read the photo.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export default function ReceiptImportDialog({ open, onOpenChange, onImported }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('capture');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [vendor, setVendor] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [tax, setTax] = useState('');
  const [total, setTotal] = useState('');
  const [lines, setLines] = useState<ReviewLine[]>([]);
  const [raw, setRaw] = useState<ParsedReceipt | null>(null);
  const [duplicate, setDuplicate] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep('capture');
    setFile(null);
    setPreviewUrl(null);
    setLines([]);
    setDuplicate(null);
    setVendor(''); setInvoiceNumber(''); setInvoiceDate('');
    setSubtotal(''); setTax(''); setTotal('');
    (async () => {
      const { data } = await supabase
        .from('chemical_catalog' as any)
        .select('slug, label, sku, active')
        .eq('active', true);
      const rows = (data as any[]) || [];
      const items: CatalogItem[] = rows.length
        ? rows
            .filter(r => r.slug !== 'other')
            .map(r => ({
              id: r.slug,
              label: r.label,
              sku: r.sku,
              baseUnit: (CHEMICAL_BASE_UNIT[r.slug] ?? 'lbs') as 'lbs' | 'gal',
            }))
        : CHEMICAL_OPTIONS.filter(o => o.id !== 'other').map(o => ({
            id: o.id,
            label: o.label,
            sku: null,
            baseUnit: (CHEMICAL_BASE_UNIT[o.id] ?? 'lbs') as 'lbs' | 'gal',
          }));
      setCatalog(items);
    })();
  }, [open]);

  async function checkDuplicate(v: string, inv: string, date: string, tot: string) {
    if (inv.trim() && v.trim()) {
      const { data } = await supabase
        .from('inventory_receipts' as any)
        .select('id, created_at')
        .ilike('vendor', v.trim())
        .ilike('invoice_number', inv.trim())
        .limit(1);
      if ((data as any[])?.length) {
        setDuplicate(`Invoice ${inv.trim()} from ${v.trim()} has already been imported.`);
        return;
      }
    }
    if (!inv.trim() && v.trim() && date && tot) {
      const { data } = await supabase
        .from('inventory_receipts' as any)
        .select('id')
        .ilike('vendor', v.trim())
        .eq('invoice_date', date)
        .eq('total', Number(tot))
        .limit(1);
      if ((data as any[])?.length) {
        setDuplicate(`A receipt from ${v.trim()} dated ${date} for ${fmtMoney(Number(tot))} was already imported.`);
        return;
      }
    }
    setDuplicate(null);
  }

  async function handleFile(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setPreviewUrl(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
    setStep('analyzing');
    try {
      const dataUrl = await fileToDataUrl(f);
      const { data, error } = await supabase.functions.invoke('parse-receipt', {
        body: { dataUrl, mimeType: f.type, filename: f.name },
      });
      if (error) throw new Error((data as any)?.error || error.message);
      const parsed = (data as any)?.data as ParsedReceipt;
      if (!parsed) throw new Error('Nothing could be read from that file.');
      setRaw(parsed);
      setVendor(parsed.vendor ?? '');
      setInvoiceNumber(parsed.invoice_number ?? '');
      setInvoiceDate(parsed.invoice_date ?? '');
      setSubtotal(parsed.subtotal != null ? String(parsed.subtotal) : '');
      setTax(parsed.tax != null ? String(parsed.tax) : '');
      setTotal(parsed.total != null ? String(parsed.total) : '');
      setLines(toReviewLines(parsed, catalog));
      setStep('review');
      await checkDuplicate(
        parsed.vendor ?? '',
        parsed.invoice_number ?? '',
        parsed.invoice_date ?? '',
        parsed.total != null ? String(parsed.total) : '',
      );
    } catch (err: any) {
      toast({ title: 'Could not read that receipt', description: err.message, variant: 'destructive' });
      setStep('capture');
    }
  }

  function updateLine(key: string, patch: Partial<ReviewLine>) {
    setLines(prev => prev.map(l => (l.key === key ? { ...l, ...patch } : l)));
  }

  function baseUnitOf(line: ReviewLine): 'lbs' | 'gal' {
    if (line.createNew || !line.matchedId) return line.newBaseUnit;
    return baseUnitForCatalogId(line.matchedId, catalog);
  }

  async function confirm() {
    const included = lines.filter(l => l.include);
    if (!included.length) {
      toast({ title: 'Nothing to add', description: 'Select at least one line item.', variant: 'destructive' });
      return;
    }
    for (const l of included) {
      if (!l.matchedId && !l.createNew) {
        toast({
          title: 'Unmatched item',
          description: `Pick an inventory item or create a new one for "${l.description || l.sku}".`,
          variant: 'destructive',
        });
        return;
      }
      if (l.createNew && !l.newLabel.trim()) {
        toast({ title: 'Name required', description: 'Give the new inventory item a name.', variant: 'destructive' });
        return;
      }
    }

    setStep('saving');
    try {
      // 1. Store the original document
      let imagePath: string | null = null;
      if (file) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${user?.id ?? 'unknown'}/${Date.now()}-receipt.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('inventory-receipts')
          .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
        if (upErr) throw upErr;
        imagePath = path;
      }

      // 2. Receipt header
      const { data: receipt, error: rErr } = await supabase
        .from('inventory_receipts' as any)
        .insert({
          vendor: vendor.trim() || null,
          invoice_number: invoiceNumber.trim() || null,
          invoice_date: invoiceDate || null,
          subtotal: subtotal ? Number(subtotal) : null,
          tax: tax ? Number(tax) : null,
          total: total ? Number(total) : null,
          image_path: imagePath,
          raw_extraction: raw as any,
          created_by: user?.id ?? null,
        })
        .select('id')
        .single();
      if (rErr) throw rErr;
      const receiptId = (receipt as any).id as string;

      // 3. Each line: create item if needed, log purchase, record line
      for (const l of included) {
        let chemicalId = l.matchedId;
        let label = chemicalId ? catalog.find(c => c.id === chemicalId)?.label ?? l.newLabel : l.newLabel.trim();
        const base = baseUnitOf(l);

        if (l.createNew) {
          const slug = slugify(l.newLabel);
          const units = base === 'gal' ? ['gal', 'qt'] : ['lbs', 'oz'];
          const { error: cErr } = await supabase.from('chemical_catalog' as any).upsert(
            {
              slug,
              label: l.newLabel.trim(),
              units,
              purpose: '',
              sort_order: 999,
              active: true,
              is_other: false,
              sku: l.sku.trim() || null,
            },
            { onConflict: 'slug' },
          );
          if (cErr) throw cErr;
          chemicalId = slug;
          label = l.newLabel.trim();
        } else if (l.sku.trim() && chemicalId) {
          // Remember the vendor SKU so the next invoice matches instantly.
          await supabase
            .from('chemical_catalog' as any)
            .update({ sku: l.sku.trim() })
            .eq('slug', chemicalId)
            .is('sku', null);
        }

        const baseQty = baseQuantityFor(l, base);
        const cost = lineCostFor(l);

        const { data: purchase, error: pErr } = await supabase
          .from('chemical_inventory_purchases')
          .insert({
            chemical_id: chemicalId!,
            chemical_label: label,
            unit: base,
            quantity: baseQty,
            total_cost: cost,
            purchased_at: invoiceDate ? new Date(invoiceDate).toISOString() : new Date().toISOString(),
            notes: [vendor.trim(), invoiceNumber.trim() && `Invoice ${invoiceNumber.trim()}`]
              .filter(Boolean)
              .join(' · ') || null,
            created_by: user?.id ?? null,
          })
          .select('id')
          .single();
        if (pErr) throw pErr;

        const { error: iErr } = await supabase.from('inventory_receipt_items' as any).insert({
          receipt_id: receiptId,
          chemical_id: chemicalId,
          chemical_label: label,
          sku: l.sku.trim() || null,
          description: l.description || null,
          quantity: l.quantity ? Number(l.quantity) : null,
          package_size: l.packageSize ? Number(l.packageSize) : null,
          package_unit: l.packageUnit || null,
          unit: base,
          base_quantity: baseQty,
          unit_price: l.unitPrice ? Number(l.unitPrice) : null,
          line_total: cost,
          purchase_id: (purchase as any).id,
        });
        if (iErr) throw iErr;
      }

      toast({ title: 'Added to inventory', description: `${included.length} item${included.length > 1 ? 's' : ''} received.` });
      onImported();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Could not save', description: err.message, variant: 'destructive' });
      setStep('review');
    }
  }

  const grandTotal = lines.filter(l => l.include).reduce((s, l) => s + lineCostFor(l), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto z-[100]">
        <DialogHeader>
          <DialogTitle>Scan a receipt or invoice</DialogTitle>
          <DialogDescription>
            Take a photo or choose a file. Nothing is added to inventory until you review and confirm.
          </DialogDescription>
        </DialogHeader>

        {step === 'capture' && (
          <div className="space-y-3">
            {readError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Could not read that file</AlertTitle>
                <AlertDescription>{readError}</AlertDescription>
              </Alert>
            )}

            {/* Labels wrap the inputs so the native picker opens from the tap itself.
                iOS Safari ignores clicks on display:none inputs, so they are only visually hidden. */}
            <label
              htmlFor="receipt-camera-input"
              className="relative flex h-20 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/80"
            >
              <Camera className="h-6 w-6" /> Take Photo
              <input
                id="receipt-camera-input"
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                onChange={e => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>

            <label
              htmlFor="receipt-file-input"
              className="relative flex h-20 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Upload className="h-6 w-6" /> Choose Photo / File
              <input
                id="receipt-file-input"
                ref={fileRef}
                type="file"
                accept="image/*,image/heic,image/heif,application/pdf"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                onChange={e => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>

            <p className="text-center text-xs text-muted-foreground">
              If your device can't open the camera directly, use "Choose Photo / File" — it can also take a new photo.
            </p>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Reading the receipt…</p>
          </div>
        )}

        {(step === 'review' || step === 'saving') && (
          <div className="space-y-4">
            {duplicate && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Possible duplicate</AlertTitle>
                <AlertDescription>{duplicate} You can still continue if this is a different order.</AlertDescription>
              </Alert>
            )}

            {previewUrl && (
              <img src={previewUrl} alt="Receipt" className="max-h-48 w-auto rounded border object-contain mx-auto" />
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Vendor</Label>
                <Input value={vendor} onChange={e => setVendor(e.target.value)} />
              </div>
              <div>
                <Label>Invoice #</Label>
                <Input
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  onBlur={() => checkDuplicate(vendor, invoiceNumber, invoiceDate, total)}
                />
              </div>
              <div>
                <Label>Purchase date</Label>
                <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Subtotal</Label>
                  <Input type="number" step="0.01" value={subtotal} onChange={e => setSubtotal(e.target.value)} />
                </div>
                <div>
                  <Label>Tax</Label>
                  <Input type="number" step="0.01" value={tax} onChange={e => setTax(e.target.value)} />
                </div>
                <div>
                  <Label>Total</Label>
                  <Input type="number" step="0.01" value={total} onChange={e => setTotal(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {lines.map(line => {
                const base = baseUnitOf(line);
                const addQty = baseQuantityFor(line, base);
                return (
                  <Card key={line.key} className={line.include ? '' : 'opacity-60'}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={line.include}
                          onCheckedChange={v => updateLine(line.key, { include: !!v })}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-2">
                          <Input
                            value={line.description}
                            onChange={e => updateLine(line.key, { description: e.target.value })}
                            placeholder="Description"
                          />
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <Label className="text-xs">Item / SKU</Label>
                              <Input value={line.sku} onChange={e => updateLine(line.key, { sku: e.target.value })} />
                            </div>
                            <div>
                              <Label className="text-xs">Qty (containers)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={line.quantity}
                                onChange={e => updateLine(line.key, { quantity: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Unit price</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={line.unitPrice}
                                onChange={e => updateLine(line.key, { unitPrice: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Line total</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={line.lineTotal}
                                onChange={e => updateLine(line.key, { lineTotal: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Package size</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={line.packageSize}
                                onChange={e => updateLine(line.key, { packageSize: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Package unit</Label>
                              <Select
                                value={line.packageUnit || 'none'}
                                onValueChange={v =>
                                  updateLine(line.key, { packageUnit: v === 'none' ? '' : (v as ReviewLine['packageUnit']) })
                                }
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent className="z-[120]">
                                  <SelectItem value="none">—</SelectItem>
                                  <SelectItem value="lbs">lbs</SelectItem>
                                  <SelectItem value="oz">oz</SelectItem>
                                  <SelectItem value="gal">gal</SelectItem>
                                  <SelectItem value="qt">qt</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs">Inventory item</Label>
                              <Select
                                value={line.createNew ? '__new__' : line.matchedId ?? '__none__'}
                                onValueChange={v =>
                                  updateLine(line.key, {
                                    createNew: v === '__new__',
                                    matchedId: v === '__new__' || v === '__none__' ? null : v,
                                    matchSource: 'none',
                                  })
                                }
                              >
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent className="z-[120]">
                                  <SelectItem value="__none__">Not matched</SelectItem>
                                  <SelectItem value="__new__">+ Create new inventory item</SelectItem>
                                  {catalog.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {line.createNew && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">New item name</Label>
                                <Input
                                  value={line.newLabel}
                                  onChange={e => updateLine(line.key, { newLabel: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Tracked in</Label>
                                <Select
                                  value={line.newBaseUnit}
                                  onValueChange={v => updateLine(line.key, { newBaseUnit: v as 'lbs' | 'gal' })}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent className="z-[120]">
                                    <SelectItem value="lbs">Pounds (lbs)</SelectItem>
                                    <SelectItem value="gal">Gallons (gal)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            {line.matchSource === 'sku' && <Badge variant="secondary">Matched by item code</Badge>}
                            {line.matchSource === 'name' && <Badge variant="secondary">Matched by name</Badge>}
                            {!line.matchedId && !line.createNew && <Badge variant="destructive">No match</Badge>}
                            <span className="text-muted-foreground inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Adds {addQty.toFixed(2)} {base} · {fmtMoney(lineCostFor(line))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <div className="text-sm text-muted-foreground">
                Line items selected: <strong>{lines.filter(l => l.include).length}</strong> · {fmtMoney(grandTotal)}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('capture')} disabled={step === 'saving'}>
                  Rescan
                </Button>
                <Button onClick={confirm} disabled={step === 'saving'} className="min-w-[200px]">
                  {step === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm & Add to Inventory'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
