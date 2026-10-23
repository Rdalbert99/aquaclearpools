import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { accountSummary, type AccountSummary, type BalanceLookup } from '@/lib/account-balance';

const usd = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
export const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

/** Read-only QuickBooks open balances. Any failure yields "unavailable" for every client, never $0. */
export function useOpenBalances(clientIds: string[], mode: 'admin' | 'customer', enabled = true) {
  const [balances, setBalances] = useState<Record<string, BalanceLookup>>({});
  const [loading, setLoading] = useState(false);
  const key = clientIds.join();
  const load = async () => {
    if (!enabled || !clientIds.length) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('qbo-connect', {
      body: { action: mode === 'admin' ? 'open_invoices' : 'my_open_invoices', clientIds },
    });
    const fallback: Record<string, BalanceLookup> = Object.fromEntries(clientIds.map((id) => [id, { status: 'unavailable', reason: 'QuickBooks balance could not be read' }]));
    setBalances(error || !data?.balances ? fallback : { ...fallback, ...data.balances });
    setLoading(false);
  };
  useEffect(() => { load(); }, [key, mode, enabled]);
  return { balances, loading, reload: load };
}

export function AccountBalancePanel({ summary, newLabel = 'This invoice' }: { summary: AccountSummary; newLabel?: string }) {
  return (
    <div className="space-y-1 rounded-md bg-muted/50 p-2 text-xs">
      <div className="flex justify-between"><span>{newLabel}</span><span className="font-medium">{usd(summary.newInvoiceCents)}</span></div>
      {!summary.available ? (
        <p className="text-muted-foreground">Earlier balance unavailable ({summary.reason}). No account total shown.</p>
      ) : (
        <>
          {summary.previous.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-1">
              <span>
                Earlier invoice #{i.docNumber ?? i.id}{i.dueDate ? ` · due ${i.dueDate}` : ''}
                {i.balanceCents < i.totalCents ? ` · partly paid (of ${usd(i.totalCents)})` : ''}
                {i.pastDue && <Badge variant="destructive" className="ml-1 px-1 py-0 text-[10px]">Past due</Badge>}
                {i.paymentLink && <a href={i.paymentLink} target="_blank" rel="noopener noreferrer" className="ml-1 text-primary underline">Pay</a>}
              </span>
              <span>{usd(i.balanceCents)}</span>
            </div>
          ))}
          {summary.previous.length === 0 && <p className="text-muted-foreground">No earlier unpaid invoices.</p>}
          <div className="flex justify-between border-t pt-1 font-semibold"><span>Account total due</span><span>{usd(summary.totalCents!)}</span></div>
        </>
      )}
    </div>
  );
}

export { accountSummary };
