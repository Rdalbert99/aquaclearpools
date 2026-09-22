import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { fmtMoney } from '@/lib/inventory-cost';
import { FileText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ReceiptRow {
  id: string;
  vendor: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total: number | null;
  image_path: string | null;
  created_at: string;
}

export default function ReceiptHistory({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<ReceiptRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('inventory_receipts' as any)
        .select('id, vendor, invoice_number, invoice_date, total, image_path, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      setRows((data as any) ?? []);
    })();
  }, [refreshKey]);

  async function view(path: string | null) {
    if (!path) return;
    const { data, error } = await supabase.storage.from('inventory-receipts').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast({ title: 'Could not open the receipt', description: error?.message, variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  if (!rows.length) return null;

  return (
    <Card>
      <CardHeader><CardTitle>Scanned receipts</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.invoice_date ?? new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{r.vendor ?? '—'}</TableCell>
                  <TableCell>{r.invoice_number ?? '—'}</TableCell>
                  <TableCell className="text-right">{fmtMoney(Number(r.total ?? 0))}</TableCell>
                  <TableCell className="text-right">
                    {r.image_path && (
                      <Button variant="ghost" size="sm" onClick={() => view(r.image_path)}>
                        <FileText className="h-4 w-4 mr-1" /> View
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
