import { useEffect, useMemo, useState, useRef } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';
import { saveEnrollment, firstMonthLabel, defaultEnrollment, type EnrollmentAdapter, type EnrollmentScope } from '@/lib/billing-enrollment';
import { authenticatedEnrollmentAdapter, billingInvoke } from '@/lib/billing-transport';
import { setUnsavedWork } from '@/lib/unsaved-work';
import { OWNER_IDS, type Enrollment } from '@/lib/billing-readiness';
export function AutomaticInvoicing({ clientId, customerName = '', readOnly = false, adapter = authenticatedEnrollmentAdapter, scope = null, onDraftChange }: {
  clientId?: string; customerName?: string; readOnly?: boolean; adapter?: EnrollmentAdapter; scope?: EnrollmentScope | null; onDraftChange?: (draft: Enrollment) => void;
}) {
  const version=useRef(0);
  const [policy,setPolicy]=useState<{invoiceEnabled:boolean}|null>(null);
  const [saved, setSaved] = useState<Enrollment | null>(null);
  const [draft, setDraft] = useState(defaultEnrollment);
  const [message, setMessage] = useState('Not saved — backend setup pending');
  const [busy, setBusy] = useState(false);
  const [resolvedScope, setResolvedScope] = useState<EnrollmentScope | null>(null);
  const effectiveScope = useMemo(() => scope ?? resolvedScope, [scope, resolvedScope]);
  const held = clientId === OWNER_IDS.laken || ['laken ford ramey', 'laken ramey'].includes(customerName.trim().toLowerCase());
  useEffect(() => {
    let cancelled = false;version.current++;setResolvedScope(null);setBusy(false);setPolicy(null);
    setSaved(null); setDraft(defaultEnrollment()); setMessage('Not saved — backend setup pending');
    if(adapter.ready){void billingInvoke<{policy:{invoiceEnabled:boolean}}>({action:'policy'}).then(r=>{if(!cancelled)setPolicy(r.policy);}).catch(()=>{});}
    if (adapter.ready && clientId) {
      const load = async () => {
        if (scope) return { scope, enrollment: await adapter.load(scope) };
        return billingInvoke<{ scope: Omit<EnrollmentScope, 'clientId'>; enrollment: Enrollment | null }>({ action: 'read_enrollment', clientId });
      };
      load().then(result => {
        if (cancelled) return;
        const value = result.enrollment;
        setResolvedScope({ ...result.scope, clientId });
        setSaved(value); setDraft(value ?? defaultEnrollment()); setMessage(value ? 'Saved enrollment loaded' : 'Not enrolled — default off');
      }).catch(error => { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Enrollment unavailable'); });
    }
    return () => { cancelled = true; };
  }, [adapter, scope, clientId]);
  const save = async () => {
    const request=version.current;setBusy(true);
    try {
      if (held && draft.enabled) throw new Error('Owner hold — separate deliberate release required');
      const result = await saveEnrollment(adapter, effectiveScope, { enabled: draft.enabled, firstServicePeriod: draft.firstServicePeriod, expectedRevision: saved?.revision ?? 0 });
      if(version.current!==request)return;
      setSaved(result); setDraft(result); setMessage('Enrollment saved; this does not send an invoice');
    } catch (error) { if(version.current===request)setMessage(error instanceof Error ? error.message : 'Not saved'); }
    finally { if(version.current===request)setBusy(false); }
  };
  const dirty=draft.enabled!==(saved?.enabled??false)||draft.firstServicePeriod!==(saved?.firstServicePeriod??null);
  useEffect(()=>{const id=`billing-enrollment:${clientId??'new'}`;setUnsavedWork(id,dirty);return()=>setUnsavedWork(id,false);},[clientId,dirty]);
  let first = 'First service month not selected';
  try { if (draft.firstServicePeriod) first = firstMonthLabel(draft.firstServicePeriod); } catch { first = 'Choose a valid service month'; }
  return <section className="space-y-3 border-y py-4" aria-label="Automatic invoicing">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Automatic invoicing</h2><span className="text-sm text-muted-foreground">Global sender: {policy ? policy.invoiceEnabled ? 'enabled on server' : 'disabled on server' : 'unavailable'}</span></div>
    <div className="flex items-center gap-3"><Switch id={`auto-invoice-${clientId ?? 'new'}`} checked={draft.enabled} disabled={readOnly || held || busy} onCheckedChange={enabled => { const next = { ...draft, enabled }; setDraft(next); onDraftChange?.(next); setMessage('Not saved — draft enrollment only'); }} /><Label htmlFor={`auto-invoice-${clientId ?? 'new'}`}>Customer enrollment {saved ? saved.enabled ? 'on' : 'off' : 'not saved (default off)'}</Label></div>
    <div className="max-w-sm space-y-1"><Label htmlFor={`first-invoice-${clientId ?? 'new'}`}>First billing month (service month)</Label><Input id={`first-invoice-${clientId ?? 'new'}`} type="month" value={draft.firstServicePeriod ?? ''} disabled={readOnly || held || busy} onChange={e => { const next = { ...draft, firstServicePeriod: e.target.value || null }; setDraft(next); onDraftChange?.(next); setMessage('Not saved — draft enrollment only'); }} /></div>
    <p className="text-sm">{first}</p>
    <p className="text-sm text-muted-foreground">Independent of service status, season and invoice delivery preferences. No card charge, proration or backbilling is authorized.</p>
    {held && <p className="text-sm font-medium text-destructive">Owner hold — enrollment cannot release it. Existing rate is unchanged.</p>}
    <p role="status" className="text-sm">{message}{!adapter.ready ? ' · No enrollment changes can be persisted yet.' : ''}</p>
    {!readOnly && clientId && <Button variant="outline" onClick={() => void save()} disabled={busy || held || !effectiveScope}>{busy ? 'Saving…' : 'Save enrollment'}</Button>}
    {!clientId && <p className="text-sm text-muted-foreground">Enrollment will be saved separately after the customer has been created. A failed enrollment save leaves it off.</p>}
    <Link className="block text-sm text-primary underline" to={readOnly && clientId ? `/admin/clients/${clientId}/edit` : '/admin/invoice-delivery'}>{readOnly ? 'Edit customer enrollment' : 'Billing readiness checklist'}</Link>
  </section>;
}
