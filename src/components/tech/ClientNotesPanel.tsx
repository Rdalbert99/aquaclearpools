import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardList } from 'lucide-react';

interface RequestRow {
  id: string;
  request_type: string;
  description: string;
  status: string;
  preferred_date: string | null;
  created_at: string;
}

export function ClientNotesPanel({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<RequestRow[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('service_requests')
      .select('id, request_type, description, status, preferred_date, created_at')
      .eq('client_id', clientId)
      .in('status', ['pending', 'in-progress'])
      .order('created_at', { ascending: false })
      .limit(10);
    setRows((data as RequestRow[]) || []);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const markHandled = async (id: string) => {
    const { error } = await supabase
      .from('service_requests')
      .update({ status: 'completed', completed_date: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Marked handled' });
    load();
  };

  if (rows.length === 0) return null;

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" /> Customer Notes & Requests
        </CardTitle>
        <CardDescription>Open items the customer asked you to look at</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <Badge variant="outline" className="capitalize">
                {r.request_type.replace('_', ' ')}
              </Badge>
              <p className="text-sm">{r.description}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString()}
                {r.preferred_date ? ` · prefers ${new Date(r.preferred_date).toLocaleDateString()}` : ''}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => markHandled(r.id)}>
              Mark handled
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
