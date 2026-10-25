import { useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';
import { pendingEnrollmentAdapter, saveEnrollment, firstMonthLabel, defaultEnrollment, type EnrollmentAdapter, type EnrollmentScope } from '@/lib/billing-enrollment';
import { OWNER_IDS, type Enrollment } from '@/lib/billing-readiness';
export function AutomaticInvoicing({ clientId, customerName = '', readOnly = false, adapter = pendingEnrollmentAdapter, scope = null }: {
  clientId?: string; customerName?: string; readOnly?: boolean; adapter?: EnrollmentAdapter; scope?: EnrollmentScope | null;
}) {
  const [saved, setSaved] = useState<Enrollment | null>(null);
  const [draft, setDraft] = useState(defaultEnrollment);
  const [message, setMessage] = useState('Not saved — backend setup pending');
  const [busy, setBusy] = useState(false);
  const held = clientId === OWNER_IDS.laken || ['laken ford ramey', 'laken ramey'].includes(customerName.trim().toLowerCase());
  useEffect(() => {
    let cancelled = false;
    setSaved(null); setDraft(defaultEnrollment()); setMessage('Not saved — backend setup pending');
    if (adapter.ready && scope) {
      adapter.load(scope).then(value => {
        if (cancelled) return;
        setSaved(value); setDraft(value ?? defaultEnrollment()); setMessage(value ? 'Saved enrollment loaded' : 'Not enrolled — default off');
      }).catch(error => { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Enrollment unavailable'); });
    }
    return () => { cancelled = true; };
  }, [adapter, scope]);
  const save = async () => {
    setBusy(true);
    try {
      if (held && draft.enabled) throw new Error('Owner hold — separate deliberate release required');
      const result = await saveEnrollment(adapter, scope, { enabled: draft.enabled, firstServicePeriod: draft.firstServicePeriod, expectedRevision: saved?.revision ?? 0 });
      setSaved(result); setDraft(result); setMessage('Enrollment saved; global sending remains disabled');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Not saved'); }
    finally { setBusy(false); }
  };
  let first = 'First service month not selected';
  try { if (draft.firstServicePeriod) first = firstMonthLabel(draft.firstServicePeriod); } catch { first = 'Choose a valid service month'; }
  return <section className="space-y-3 border-y py-4" aria-label="Automatic invoicing">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Automatic invoicing</h2><span className="text-sm text-muted-foreground">Global sender: disabled</span></div>
    <div className="flex items-center gap-3"><Switch id={`auto-invoice-${clientId ?? 'new'}`} checked={draft.enabled} disabled={readOnly || held || busy} onCheckedChange={enabled => { setDraft(d => ({ ...d, enabled })); setMessage('Not saved — draft enrollment only'); }} /><Label htmlFor={`auto-invoice-${clientId ?? 'new'}`}>Customer enrollment {saved ? saved.enabled ? 'on' : 'off' : 'not saved (default off)'}</Label></div>
    <div className="max-w-sm space-y-1"><Label htmlFor={`first-invoice-${clientId ?? 'new'}`}>First billing month (service month)</Label><Input id={`first-invoice-${clientId ?? 'new'}`} type="month" value={draft.firstServicePeriod ?? ''} disabled={readOnly || held || busy} onChange={e => { setDraft(d => ({ ...d, firstServicePeriod: e.target.value || null })); setMessage('Not saved — draft enrollment only'); }} /></div>
    <p className="text-sm">{first}</p>
    <p className="text-sm text-muted-foreground">Independent of service status, season and invoice delivery preferences. No card charge, proration or backbilling is authorized.</p>
    {held && <p className="text-sm font-medium text-destructive">Owner hold — enrollment cannot release it. Existing rate is unchanged.</p>}
    <p role="status" className="text-sm">{message}{!adapter.ready ? ' · No enrollment changes can be persisted yet.' : ''}</p>
    {!readOnly && <Button variant="outline" onClick={() => void save()} disabled={busy || held}>{busy ? 'Saving…' : 'Save enrollment'}</Button>}
    <Link className="block text-sm text-primary underline" to={readOnly && clientId ? `/admin/clients/${clientId}/edit` : '/admin/invoice-delivery'}>{readOnly ? 'Edit customer enrollment' : 'Billing readiness checklist'}</Link>
  </section>;
}
