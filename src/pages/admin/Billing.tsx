import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Receipt, ShieldCheck } from 'lucide-react';
import {
  LINE_KINDS, autoAllocate, centsToInput, fromCents, lineAmountCents, monthRange, toCents,
  type LineKind,
} from '@/lib/billing';

// New billing tables may not be in generated types yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Business { id: string; name: string; billing_mode: string }
interface ClientLite { id: string; customer: string; service_rate: number | null }
interface Invoice {
  id: string; client_id: string; number: string | null; status: string;
  period_start: string | null; period_end: string | null; issue_date: string | null; due_date: string | null;
  total_cents: number; paid_cents: number; notes: string | null; created_at: string;
}
interface DraftLine { key: string; kind: LineKind; description: string; quantity: string; unit: string }
interface Payment { id: string; client_id: string; method: string; amount_cents: number; reference: string | null; received_at: string; notes: string | null }
interface Ledger { id: string; account: string; debit_cents: number; credit_cents: number; memo: string | null; created_at: string; client_id: string | null }

const errMsg = (e: unknown) => (e as { message?: string })?.message ?? 'Something went wrong';
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const newKey = () => Math.random().toString(36).slice(2);

export default function Billing() {
  const { user } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  const clientName = useCallback((id: string | null) => clients.find(c => c.id === id)?.customer ?? 'Customer', [clients]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: biz } = await db.from('businesses').select('id, name, billing_mode').eq('slug', 'aqua-clear').maybeSingle();
    setBusiness(biz ?? null);
    if (!biz) { setLoading(false); return; }
    const [c, r, i, p, l] = await Promise.all([
      supabase.from('clients').select('id, customer, service_rate').order('customer'),
      db.from('billing_customers').select('client_id, monthly_rate_cents').eq('business_id', biz.id),
      db.from('invoices').select('*').eq('business_id', biz.id).order('created_at', { ascending: false }).limit(300),
      db.from('payments').select('*').eq('business_id', biz.id).order('created_at', { ascending: false }).limit(300),
      db.from('ledger_entries').select('id, account, debit_cents, credit_cents, memo, created_at, client_id').eq('business_id', biz.id).order('created_at', { ascending: false }).limit(300),
    ]);
    setClients((c.data ?? []) as ClientLite[]);
    setRates(Object.fromEntries(((r.data ?? []) as { client_id: string; monthly_rate_cents: number }[]).map(x => [x.client_id, x.monthly_rate_cents])));
    setInvoices((i.data ?? []) as Invoice[]);
    setPayments((p.data ?? []) as Payment[]);
    setLedger((l.data ?? []) as Ledger[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (user?.id) load(); }, [user?.id, load]);

  const totals = useMemo(() => {
    const open = invoices.filter(i => i.status === 'open');
    return {
      drafts: invoices.filter(i => i.status === 'draft').length,
      outstanding: open.reduce((s, i) => s + i.total_cents - i.paid_cents, 0),
      debits: ledger.reduce((s, e) => s + e.debit_cents, 0),
      credits: ledger.reduce((s, e) => s + e.credit_cents, 0),
    };
  }, [invoices, ledger]);

  async function issue(inv: Invoice) {
    if (!confirm(`Issue this invoice to ${clientName(inv.client_id)}? Once issued it is locked and can only be voided.`)) return;
    const { error } = await db.rpc('billing_issue_invoice', { _invoice_id: inv.id, _due_date: null });
    if (error) return toast({ title: 'Could not issue invoice', description: error.message, variant: 'destructive' });
    toast({ title: 'Invoice issued', description: 'Nothing was sent to the customer — billing is off.' });
    load();
  }

  async function voidInvoice(inv: Invoice) {
    const reason = prompt(`Reason for voiding ${inv.number}?`);
    if (!reason?.trim()) return;
    const { error } = await db.rpc('billing_void_invoice', { _invoice_id: inv.id, _reason: reason.trim() });
    if (error) return toast({ title: 'Could not void invoice', description: error.message, variant: 'destructive' });
    toast({ title: 'Invoice voided' });
    load();
  }

  async function deleteDraft(inv: Invoice) {
    if (!confirm('Delete this draft?')) return;
    const { error } = await db.from('invoices').delete().eq('id', inv.id);
    if (error) return toast({ title: 'Could not delete draft', description: error.message, variant: 'destructive' });
    load();
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading billing…</div>;
  if (!business) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Alert><AlertTitle>No billing access</AlertTitle><AlertDescription>Your account isn't a billing member of Aqua Clear Pools.</AlertDescription></Alert>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="h-6 w-6 text-primary" /> Billing</h1>
          <p className="text-sm text-muted-foreground">{business.name} · invoices, payments and ledger</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPayOpen(true)}>Record cash / check</Button>
          <Button onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New draft invoice</Button>
        </div>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Billing mode: {business.billing_mode.toUpperCase()}</AlertTitle>
        <AlertDescription>
          QuickBooks remains the official record. Nothing here is sent to customers or charged, and customers can't see these invoices.
          Use this to practice and to build shadow invoices for reconciliation.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>Drafts</CardDescription><CardTitle>{totals.drafts}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Outstanding (issued, unpaid)</CardDescription><CardTitle>{fromCents(totals.outstanding)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Ledger check</CardDescription>
          <CardTitle className="text-base">{totals.debits === totals.credits ? 'Balanced' : 'Out of balance'} · {fromCents(totals.debits)}</CardTitle></CardHeader></Card>
      </div>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card><CardContent className="pt-6 overflow-x-auto">
            {invoices.length === 0 ? <p className="text-sm text-muted-foreground">No invoices yet.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Number</TableHead><TableHead>Customer</TableHead><TableHead>Period</TableHead>
                  <TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Balance</TableHead><TableHead />
                </TableRow></TableHeader>
                <TableBody>
                  {invoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.number ?? 'Draft'}</TableCell>
                      <TableCell>{clientName(inv.client_id)}</TableCell>
                      <TableCell className="text-xs">{inv.period_start ?? '—'}{inv.period_end ? ` → ${inv.period_end}` : ''}</TableCell>
                      <TableCell><Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'void' ? 'outline' : 'secondary'}>{inv.status}</Badge></TableCell>
                      <TableCell className="text-right">{inv.status === 'draft' ? '—' : fromCents(inv.total_cents)}</TableCell>
                      <TableCell className="text-right">{inv.status === 'open' ? fromCents(inv.total_cents - inv.paid_cents) : '—'}</TableCell>
                      <TableCell className="text-right whitespace-nowrap space-x-1">
                        {inv.status === 'draft' && (<>
                          <Button size="sm" variant="ghost" onClick={() => { setEditing(inv); setEditorOpen(true); }}>Edit</Button>
                          <Button size="sm" variant="secondary" onClick={() => issue(inv)}>Issue</Button>
                          <Button size="icon" variant="ghost" aria-label="Delete draft" onClick={() => deleteDraft(inv)}><Trash2 className="h-4 w-4" /></Button>
                        </>)}
                        {inv.status === 'open' && inv.paid_cents === 0 && (
                          <Button size="sm" variant="ghost" onClick={() => voidInvoice(inv)}>Void</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card><CardContent className="pt-6 overflow-x-auto">
            {payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments recorded yet.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Received</TableHead><TableHead>Customer</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.received_at}</TableCell>
                      <TableCell>{clientName(p.client_id)}</TableCell>
                      <TableCell className="capitalize">{p.method}</TableCell>
                      <TableCell>{p.reference ?? '—'}</TableCell>
                      <TableCell className="text-right">{fromCents(p.amount_cents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="ledger">
          <Card><CardContent className="pt-6 overflow-x-auto">
            <p className="text-xs text-muted-foreground mb-3">Permanent record — entries can't be edited or deleted. Corrections post reversing entries.</p>
            {ledger.length === 0 ? <p className="text-sm text-muted-foreground">No entries yet.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>When</TableHead><TableHead>Account</TableHead><TableHead>Customer</TableHead><TableHead>Memo</TableHead>
                  <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {ledger.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{new Date(e.created_at).toLocaleString()}</TableCell>
                      <TableCell>{e.account}</TableCell>
                      <TableCell>{e.client_id ? clientName(e.client_id) : '—'}</TableCell>
                      <TableCell className="text-xs">{e.memo}</TableCell>
                      <TableCell className="text-right">{e.debit_cents ? fromCents(e.debit_cents) : ''}</TableCell>
                      <TableCell className="text-right">{e.credit_cents ? fromCents(e.credit_cents) : ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {editorOpen && (
        <InvoiceEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          businessId={business.id}
          clients={clients}
          rates={rates}
          invoice={editing}
          userId={user?.id ?? null}
          onSaved={() => { setEditorOpen(false); load(); }}
        />
      )}
      {payOpen && (
        <PaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          businessId={business.id}
          clients={clients}
          invoices={invoices}
          onSaved={() => { setPayOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function InvoiceEditor({ open, onOpenChange, businessId, clients, rates, invoice, userId, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; businessId: string; clients: ClientLite[];
  rates: Record<string, number>; invoice: Invoice | null; userId: string | null; onSaved: () => void;
}) {
  const [clientId, setClientId] = useState(invoice?.client_id ?? '');
  const [month, setMonth] = useState(invoice?.period_start?.slice(0, 7) ?? thisMonth());
  const [notes, setNotes] = useState(invoice?.notes ?? '');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveRate, setSaveRate] = useState(false);

  useEffect(() => {
    if (!invoice) return;
    db.from('invoice_lines').select('*').eq('invoice_id', invoice.id).order('sort_order').then(({ data }: { data: any[] | null }) => {
      setLines((data ?? []).map(l => ({ key: l.id, kind: l.kind, description: l.description, quantity: String(l.quantity), unit: centsToInput(l.unit_cents) })));
    });
  }, [invoice]);

  // Prefill the monthly service line when a customer is chosen on a new draft.
  function chooseClient(id: string) {
    setClientId(id);
    if (invoice) return;
    const c = clients.find(x => x.id === id);
    const rate = rates[id] ?? toCents(c?.service_rate ?? 0);
    setSaveRate(rates[id] === undefined);
    setLines([{ key: newKey(), kind: 'service', description: `Monthly pool service — ${monthRange(month).label}`, quantity: '1', unit: centsToInput(rate) }]);
  }

  const update = (key: string, patch: Partial<DraftLine>) => setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + lineAmountCents(l.quantity, toCents(l.unit)), 0);

  async function save() {
    if (!clientId) return toast({ title: 'Choose a customer', variant: 'destructive' });
    const clean = lines.filter(l => l.description.trim());
    if (!clean.length) return toast({ title: 'Add at least one line', variant: 'destructive' });
    setSaving(true);
    try {
      const { start, end } = monthRange(month);
      let id = invoice?.id;
      if (id) {
        const { error } = await db.from('invoices').update({ client_id: clientId, period_start: start, period_end: end, notes: notes || null }).eq('id', id);
        if (error) throw error;
        const del = await db.from('invoice_lines').delete().eq('invoice_id', id);
        if (del.error) throw del.error;
      } else {
        const { data, error } = await db.from('invoices').insert({
          business_id: businessId, client_id: clientId, period_start: start, period_end: end, notes: notes || null, created_by: userId,
        }).select('id').single();
        if (error) throw error;
        id = data.id;
      }
      const rows = clean.map((l, i) => {
        const unit = toCents(l.unit);
        const qty = parseFloat(l.quantity) || 0;
        return { invoice_id: id, business_id: businessId, kind: l.kind, description: l.description.trim(), quantity: qty, unit_cents: unit, amount_cents: lineAmountCents(qty, unit), sort_order: i };
      });
      const ins = await db.from('invoice_lines').insert(rows);
      if (ins.error) throw ins.error;

      const serviceLine = clean.find(l => l.kind === 'service');
      if (saveRate && serviceLine) {
        await db.from('billing_customers').upsert(
          { business_id: businessId, client_id: clientId, monthly_rate_cents: toCents(serviceLine.unit) },
          { onConflict: 'business_id,client_id' },
        );
      }
      toast({ title: 'Draft saved' });
      onSaved();
    } catch (e) {
      toast({ title: 'Could not save draft', description: errMsg(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoice ? 'Edit draft invoice' : 'New draft invoice'}</DialogTitle>
          <DialogDescription>Monthly rate plus any extras. Drafts can be changed until issued.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Customer</Label>
            <Select value={clientId} onValueChange={chooseClient}>
              <SelectTrigger><SelectValue placeholder="Choose customer" /></SelectTrigger>
              <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.customer}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-month">Billing month</Label>
            <Input id="inv-month" type="month" value={month} onChange={e => setMonth(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Lines</Label>
          {lines.map(l => (
            <div key={l.key} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-12 sm:col-span-3">
                <Select value={l.kind} onValueChange={v => update(l.key, { kind: v as LineKind })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LINE_KINDS.map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Input className="col-span-12 sm:col-span-4" placeholder="Description" value={l.description} onChange={e => update(l.key, { description: e.target.value })} />
              <Input className="col-span-3 sm:col-span-1" inputMode="decimal" aria-label="Quantity" value={l.quantity} onChange={e => update(l.key, { quantity: e.target.value })} />
              <Input className="col-span-5 sm:col-span-2" inputMode="decimal" aria-label="Unit price" placeholder="0.00" value={l.unit} onChange={e => update(l.key, { unit: e.target.value })} />
              <span className="col-span-3 sm:col-span-1 text-right text-sm">{fromCents(lineAmountCents(l.quantity, toCents(l.unit)))}</span>
              <Button className="col-span-1" size="icon" variant="ghost" aria-label="Remove line" onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setLines(ls => [...ls, { key: newKey(), kind: 'chemical', description: '', quantity: '1', unit: '' }])}>
            <Plus className="h-4 w-4 mr-1" /> Add extra
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="inv-notes">Notes</Label>
          <Textarea id="inv-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        </div>
        {saveRate && <p className="text-xs text-muted-foreground">The service line price will be saved as this customer's monthly billing rate.</p>}
        <DialogFooter className="items-center gap-3">
          <span className="mr-auto font-semibold">Total {fromCents(total)}</span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ open, onOpenChange, businessId, clients, invoices, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; businessId: string; clients: ClientLite[]; invoices: Invoice[]; onSaved: () => void;
}) {
  const [clientId, setClientId] = useState('');
  const [method, setMethod] = useState<'cash' | 'check' | 'other'>('check');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [received, setReceived] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const openInvoices = useMemo(() => invoices
    .filter(i => i.client_id === clientId && i.status === 'open')
    .sort((a, b) => (a.issue_date ?? '').localeCompare(b.issue_date ?? '')), [invoices, clientId]);

  useEffect(() => {
    const a = autoAllocate(toCents(amount), openInvoices.map(i => ({ id: i.id, balance_cents: i.total_cents - i.paid_cents })));
    setAlloc(Object.fromEntries(Object.entries(a).map(([k, v]) => [k, centsToInput(v)])));
  }, [amount, openInvoices]);

  const applied = Object.values(alloc).reduce((s, v) => s + toCents(v), 0);
  const amountCents = toCents(amount);

  async function save() {
    if (!clientId) return toast({ title: 'Choose a customer', variant: 'destructive' });
    if (amountCents <= 0) return toast({ title: 'Enter an amount', variant: 'destructive' });
    if (applied > amountCents) return toast({ title: 'Applied more than the payment amount', variant: 'destructive' });
    setSaving(true);
    const allocations = Object.entries(alloc).map(([invoice_id, v]) => ({ invoice_id, amount_cents: toCents(v) })).filter(a => a.amount_cents > 0);
    const { error } = await db.rpc('billing_record_payment', {
      _business_id: businessId, _client_id: clientId, _method: method, _amount_cents: amountCents,
      _reference: reference, _received_at: received, _notes: notes || null, _allocations: allocations,
    });
    setSaving(false);
    if (error) return toast({ title: 'Could not record payment', description: error.message, variant: 'destructive' });
    toast({ title: 'Payment recorded' });
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record cash / check payment</DialogTitle>
          <DialogDescription>Payments are permanent. Mistakes are corrected with a reversing entry, not edits.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Customer</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Choose customer" /></SelectTrigger>
              <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.customer}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={method} onValueChange={v => setMethod(v as 'cash' | 'check' | 'other')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-amt">Amount</Label>
              <Input id="pay-amt" inputMode="decimal" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-ref">{method === 'check' ? 'Check number' : 'Reference'}</Label>
              <Input id="pay-ref" value={reference} onChange={e => setReference(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-date">Received</Label>
              <Input id="pay-date" type="date" value={received} onChange={e => setReceived(e.target.value)} />
            </div>
          </div>
          {clientId && (
            <div className="space-y-2">
              <Label>Apply to invoices</Label>
              {openInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open invoices — the payment will be kept as a customer credit.</p>
              ) : openInvoices.map(i => (
                <div key={i.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{i.number} · balance {fromCents(i.total_cents - i.paid_cents)}</span>
                  <Input className="w-28" inputMode="decimal" value={alloc[i.id] ?? ''} onChange={e => setAlloc(a => ({ ...a, [i.id]: e.target.value }))} />
                </div>
              ))}
              {amountCents > applied && openInvoices.length > 0 && (
                <p className="text-xs text-muted-foreground">{fromCents(amountCents - applied)} will be kept as a customer credit.</p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="pay-notes">Notes</Label>
            <Textarea id="pay-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Record payment'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
