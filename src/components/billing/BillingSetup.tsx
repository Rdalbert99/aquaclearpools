import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { billingInvoke } from '@/lib/billing-transport';

interface ProviderEvidence { realmId: string; companyName: string; country: string; taxSupported: boolean; blockers: string[]; fingerprint: string;
  item: { id: string; name: string; active: boolean; type: string; taxable: boolean | null; incomeAccountId: string };
  account: { id: string; name: string; active: boolean; type: string } }
const msg = (e: unknown, f: string) => e instanceof Error ? e.message : f;

/** Read-only lookup of the live Item → derived income account → company; NON confirmation required before save. */
export function ProviderSetup({ onSaved }: { onSaved?: () => void }) {
  const [itemId, setItemId] = useState('1010000001');
  const [evidence, setEvidence] = useState<ProviderEvidence | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const reset = () => { seq.current++; setBusy(false); setEvidence(null); setConfirmed(false); setStatus(null); };
  const discover = async () => {
    const req = ++seq.current; const asked = itemId; setBusy(true); setEvidence(null); setConfirmed(false); setStatus(null);
    try { const r = await billingInvoke<{ provider: ProviderEvidence }>({ action: 'discover_provider', itemId: asked });
      if (seq.current === req && r.provider.item.id === asked) setEvidence(r.provider); }
    catch (e) { if (seq.current === req) setStatus(msg(e, 'Lookup failed')); }
    finally { if (seq.current === req) setBusy(false); }
  };
  const save = async () => {
    if (!evidence || !confirmed || !evidence.taxSupported) return;
    const req = ++seq.current; setBusy(true);
    try { const result = await billingInvoke<{ verified: boolean }>({ action: 'verify_provider', itemId: evidence.item.id, fingerprint: evidence.fingerprint, taxReview: { confirmed: true, taxMode: 'non_taxable', taxCode: 'NON' } });
      if (result.verified !== true) throw new Error('Provider verification was not saved');
      if (seq.current === req) { setStatus('Saved — re-read live from QuickBooks and verified'); onSaved?.(); } }
    catch (e) { if (seq.current === req) setStatus(`Not saved: ${msg(e, 'verification failed')}`); }
    finally { if (seq.current === req) setBusy(false); }
  };
  return <section className="space-y-2 border-b pb-4 text-sm">
    <h2 className="text-lg font-semibold">QuickBooks service item & tax</h2>
    <div className="flex flex-wrap items-end gap-2">
      <label className="space-y-1">Item ID<Input aria-label="QuickBooks item ID" value={itemId} onChange={e => { setItemId(e.target.value.replace(/\D/g, '')); reset(); }} className="w-44" /></label>
      <Button variant="outline" disabled={busy || !itemId} onClick={() => void discover()}>Look up in QuickBooks (read-only)</Button>
    </div>
    {evidence && <div className="space-y-1" data-testid="provider-evidence">
      <p>Company: {evidence.companyName} · realm {evidence.realmId} · {evidence.country}</p>
      <p>Item {evidence.item.id}: {evidence.item.name} · {evidence.item.type} · {evidence.item.active ? 'active' : 'inactive'} · taxable {evidence.item.taxable == null ? 'not stated' : evidence.item.taxable ? 'yes' : 'no'}</p>
      <p>Income account {evidence.account.id} (from item): {evidence.account.name} · {evidence.account.type} · {evidence.account.active ? 'active' : 'inactive'}</p>
      {evidence.blockers.map(b => <p key={b} className="text-destructive">Blocked: {b}</p>)}
      <label className="flex items-center gap-2"><Checkbox aria-label="Confirm non-taxable" checked={confirmed} disabled={!evidence.taxSupported} onCheckedChange={v => setConfirmed(v === true)} />I explicitly confirm non-taxable (NON) invoice treatment for this batch, regardless of the displayed catalog tax default. The QuickBooks item will not be changed.</label>
      <Button disabled={busy || !confirmed || !evidence.taxSupported} onClick={() => void save()}>Verify & save setup</Button>
      <Button variant="ghost" onClick={reset}>Cancel</Button>
    </div>}
    {status && <p role="status">{status}</p>}
  </section>;
}

interface QbCustomer { id: string; displayName: string; active: boolean; email: string; phone: string; address: string }
interface AppCustomer { id: string; customer: string; status: string | null; contact_email?: string | null; contact_phone?: string | null; address?: string | null }
interface Discovery { app: AppCustomer; customer: QbCustomer; fingerprint: string; scope: { realmId: string; environment: string };
  comparison: { supported: boolean; blockers: string[]; evidence: { field: string; result: string }[] } }

/** Exact customer identity mapping: live read, evidence review, explicit confirmation, live re-read on save. */
export function CustomerMapping({ clients, onSaved }: { clients: { id: string; customer: string }[]; onSaved?: () => void }) {
  const [clientId, setClientId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [search, setSearch] = useState('');
  const [leads, setLeads] = useState<QbCustomer[]>([]);
  const [found, setFound] = useState<Discovery | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const reset = () => { seq.current++; setBusy(false); setFound(null); setConfirmed(false); setStatus(null); setLeads([]); };
  const run = async <T,>(body: Record<string, unknown>, apply: (r: T) => void) => {
    const req = ++seq.current; setBusy(true); setStatus(null);
    try { const r = await billingInvoke<T>(body); if (seq.current === req) apply(r); }
    catch (e) { if (seq.current === req) setStatus(msg(e, 'Request failed')); }
    finally { if (seq.current === req) setBusy(false); }
  };
  const lookup = (id = customerId) => { const c = clientId; setFound(null); setConfirmed(false);
    return run<Discovery>({ action: 'discover_customer', clientId: c, customerId: id }, r => { if (r.app.id === c && r.customer.id === id) setFound(r); }); };
  const save = () => found && confirmed && found.comparison.supported && run<{ verified: boolean }>(
    { action: 'confirm_mapping', clientId: found.app.id, customerId: found.customer.id, fingerprint: found.fingerprint, confirmed: true },
    result => { if (result.verified !== true) throw new Error('Customer mapping was not saved'); setStatus('Saved — live customer re-read and mapping verified'); setFound(null); setConfirmed(false); onSaved?.(); });
  return <section className="space-y-2 border-b pb-4 text-sm">
    <h2 className="text-lg font-semibold">Link customer to QuickBooks</h2>
    <div className="flex flex-wrap items-end gap-2">
      <label className="space-y-1">Customer<select aria-label="App customer" className="block h-10 rounded-md border bg-background px-2" value={clientId} onChange={e => { setClientId(e.target.value); reset(); }}>
        <option value="">Choose…</option>{clients.map(c => <option key={c.id} value={c.id}>{c.customer}</option>)}</select></label>
      <label className="space-y-1">QuickBooks customer ID<Input aria-label="QuickBooks customer ID" value={customerId} onChange={e => { setCustomerId(e.target.value.replace(/\D/g, '')); reset(); }} className="w-40" /></label>
      <Button variant="outline" disabled={busy || !clientId || !customerId} onClick={() => void lookup()}>Look up</Button>
      <label className="space-y-1">or search name<Input aria-label="Search QuickBooks customers" value={search} onChange={e => setSearch(e.target.value)} className="w-44" /></label>
      <Button variant="outline" disabled={busy || !clientId || search.trim().length < 2} onClick={() => void run<{ leads: QbCustomer[] }>({ action: 'discover_customer', clientId, search }, r => setLeads(r.leads))}>Search</Button>
    </div>
    {leads.length > 0 && <ul className="space-y-1">{leads.map(l => <li key={l.id}>Lead only: {l.displayName} #{l.id} {l.active ? '' : '(inactive)'} <Button size="sm" variant="ghost" onClick={() => { setCustomerId(l.id); void lookup(l.id); }}>Review</Button></li>)}</ul>}
    {found && <div className="space-y-1" data-testid="identity-evidence">
      <p>App: {found.app.customer} · {found.app.contact_email || 'no email'} · {found.app.contact_phone || 'no phone'} · {found.app.address || 'no address'}</p>
      <p>QuickBooks #{found.customer.id} ({found.scope.environment} realm {found.scope.realmId}): {found.customer.displayName} · {found.customer.active ? 'active' : 'INACTIVE'} · {found.customer.email || 'no email'} · {found.customer.phone || 'no phone'} · {found.customer.address || 'no address'}</p>
      <p>{found.comparison.evidence.map(e => `${e.field}: ${e.result}`).join(' · ')}</p>
      {found.comparison.blockers.map(b => <p key={b} className="text-destructive">Owner review: {b}</p>)}
      <label className="flex items-center gap-2"><Checkbox aria-label="Confirm identity match" checked={confirmed} disabled={!found.comparison.supported} onCheckedChange={v => setConfirmed(v === true)} />I confirm this is the same customer</label>
      <Button disabled={busy || !confirmed || !found.comparison.supported} onClick={() => void save()}>Save verified link</Button>
      <Button variant="ghost" onClick={reset}>Cancel</Button>
    </div>}
    {status && <p role="status">{status}</p>}
  </section>;
}
