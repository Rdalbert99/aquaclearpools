import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Building2, Loader2, Plus } from 'lucide-react';
import { ISSUE_STATUSES, ISSUE_STATUS_LABEL, IssueStatus, formatDate } from '@/lib/commercial';

interface Row { [key: string]: unknown }

const STATUS_OPTIONS = ['normal', 'monitor', 'attention_needed', 'action_required'];

const CommercialAccounts = () => {
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Row[]>([]);
  const [facilities, setFacilities] = useState<Row[]>([]);
  const [pools, setPools] = useState<Row[]>([]);
  const [members, setMembers] = useState<Row[]>([]);
  const [equipment, setEquipment] = useState<Row[]>([]);
  const [issues, setIssues] = useState<Row[]>([]);
  const [clients, setClients] = useState<Row[]>([]);
  const [users, setUsers] = useState<Row[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [o, f, p, m, e, i, c, u] = await Promise.all([
      supabase.from('commercial_organizations').select('*').order('name'),
      supabase.from('facilities').select('*').order('name'),
      supabase.from('pools').select('*').order('name'),
      supabase.from('commercial_org_users').select('*'),
      supabase.from('pool_equipment').select('*').order('name'),
      supabase.from('equipment_issues').select('*').order('opened_at', { ascending: false }),
      supabase.from('clients').select('id, customer').order('customer'),
      supabase.from('users').select('id, name, email, login, role').order('name'),
    ]);
    setOrgs(o.data ?? []);
    setFacilities(f.data ?? []);
    setPools(p.data ?? []);
    setMembers(m.data ?? []);
    setEquipment(e.data ?? []);
    setIssues(i.data ?? []);
    setClients(c.data ?? []);
    setUsers(u.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const insert = async (table: string, values: Record<string, unknown>) => {
    const { error } = await supabase.from(table as never).insert(values as never);
    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Saved' });
    await load();
    return true;
  };

  const orgName = (id: unknown) => (orgs.find((o) => o.id === id)?.name as string) ?? '—';
  const facilityName = (id: unknown) => (facilities.find((f) => f.id === id)?.name as string) ?? '—';

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <main className="mx-auto max-w-6xl px-3 py-6 sm:px-6">
        <div className="mb-5 flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Commercial Accounts</h1>
            <p className="text-sm text-muted-foreground">Organizations, facilities, pools, portal users, equipment and issues.</p>
          </div>
        </div>

        <Tabs defaultValue="orgs">
          <div className="-mx-3 overflow-x-auto px-3 pb-2">
            <TabsList className="w-max">
              <TabsTrigger value="orgs">Organizations</TabsTrigger>
              <TabsTrigger value="facilities">Facilities</TabsTrigger>
              <TabsTrigger value="pools">Pools</TabsTrigger>
              <TabsTrigger value="users">Portal Users</TabsTrigger>
              <TabsTrigger value="equipment">Equipment</TabsTrigger>
              <TabsTrigger value="issues">Issues</TabsTrigger>
            </TabsList>
          </div>

          {/* ORGANIZATIONS */}
          <TabsContent value="orgs" className="space-y-3">
            <RecordDialog
              title="New organization"
              trigger="Add organization"
              fields={[
                { name: 'name', label: 'Organization name', required: true },
                { name: 'billing_email', label: 'Billing email' },
                { name: 'phone', label: 'Phone' },
                { name: 'address', label: 'Address' },
                { name: 'notes', label: 'Notes', textarea: true },
              ]}
              onSubmit={(v) => insert('commercial_organizations', v)}
            />
            {orgs.map((o) => (
              <Card key={o.id as string}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="font-medium">{o.name as string}</p>
                    <p className="text-xs text-muted-foreground">{(o.billing_email as string) || 'No billing email'}</p>
                  </div>
                  <Badge variant="secondary">
                    {facilities.filter((f) => f.organization_id === o.id).length} facilities
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* FACILITIES */}
          <TabsContent value="facilities" className="space-y-3">
            <RecordDialog
              title="New facility"
              trigger="Add facility"
              fields={[
                { name: 'organization_id', label: 'Organization', required: true, options: orgs.map((o) => ({ value: o.id as string, label: o.name as string })) },
                { name: 'name', label: 'Facility name', required: true },
                { name: 'address', label: 'Street address' },
                { name: 'city', label: 'City' },
                { name: 'state', label: 'State' },
                { name: 'zip_code', label: 'ZIP' },
                { name: 'contact_name', label: 'On-site contact' },
                { name: 'contact_phone', label: 'Contact phone' },
                { name: 'contact_email', label: 'Contact email' },
              ]}
              onSubmit={(v) => insert('facilities', v)}
            />
            {facilities.map((f) => (
              <Card key={f.id as string}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="font-medium">{f.name as string}</p>
                    <p className="text-xs text-muted-foreground">{orgName(f.organization_id)} · {(f.city as string) || '—'}</p>
                  </div>
                  <Badge variant="secondary">{pools.filter((p) => p.facility_id === f.id).length} pools</Badge>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* POOLS */}
          <TabsContent value="pools" className="space-y-3">
            <RecordDialog
              title="New commercial pool"
              trigger="Add pool"
              description="Link the pool to an existing customer record so technician visits feed the portal automatically."
              fields={[
                { name: 'facility_id', label: 'Facility', required: true, options: facilities.map((f) => ({ value: f.id as string, label: f.name as string })) },
                { name: 'name', label: 'Pool name', required: true },
                { name: 'client_id', label: 'Linked customer record', options: clients.map((c) => ({ value: c.id as string, label: c.customer as string })) },
                { name: 'pool_use', label: 'Use (lap, kids, spa…)' },
                { name: 'pool_type', label: 'Pool type' },
                { name: 'pool_size', label: 'Gallons', number: true },
                { name: 'notes', label: 'Notes', textarea: true },
              ]}
              onSubmit={(v) => insert('pools', v)}
            />
            {pools.map((p) => (
              <Card key={p.id as string}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="font-medium">{p.name as string}</p>
                    <p className="text-xs text-muted-foreground">{facilityName(p.facility_id)}</p>
                  </div>
                  <Badge variant={p.client_id ? 'secondary' : 'destructive'}>
                    {p.client_id ? `Linked: ${clients.find((c) => c.id === p.client_id)?.customer ?? 'customer'}` : 'Not linked'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* PORTAL USERS */}
          <TabsContent value="users" className="space-y-3">
            <RecordDialog
              title="Grant portal access"
              trigger="Add portal user"
              description="Read-only access. The person must already have an Aqua Clear login."
              fields={[
                { name: 'organization_id', label: 'Organization', required: true, options: orgs.map((o) => ({ value: o.id as string, label: o.name as string })) },
                { name: 'user_id', label: 'User account', required: true, options: users.map((u) => ({ value: u.id as string, label: `${u.name as string} (${u.email as string})` })) },
                { name: 'facility_id', label: 'Limit to one facility (optional)', options: facilities.map((f) => ({ value: f.id as string, label: f.name as string })) },
                { name: 'title', label: 'Title' },
              ]}
              onSubmit={(v) => insert('commercial_org_users', v)}
            />
            {members.map((m) => (
              <Card key={m.id as string}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="font-medium">{(users.find((u) => u.id === m.user_id)?.name as string) ?? 'User'}</p>
                    <p className="text-xs text-muted-foreground">
                      {orgName(m.organization_id)}{m.facility_id ? ` · ${facilityName(m.facility_id)}` : ' · all facilities'}
                    </p>
                  </div>
                  <Badge variant="secondary">{m.role as string}</Badge>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* EQUIPMENT */}
          <TabsContent value="equipment" className="space-y-3">
            <RecordDialog
              title="New equipment"
              trigger="Add equipment"
              fields={[
                { name: 'facility_id', label: 'Facility', required: true, options: facilities.map((f) => ({ value: f.id as string, label: f.name as string })) },
                { name: 'pool_id', label: 'Pool (optional)', options: pools.map((p) => ({ value: p.id as string, label: p.name as string })) },
                { name: 'name', label: 'Equipment name', required: true },
                { name: 'category', label: 'Category' },
                { name: 'manufacturer', label: 'Manufacturer' },
                { name: 'model', label: 'Model' },
                { name: 'serial_number', label: 'Serial number' },
                { name: 'installation_date', label: 'Installation date', date: true },
                { name: 'warranty_expiration', label: 'Warranty expiration', date: true },
                { name: 'status', label: 'Status', options: STATUS_OPTIONS.map((s) => ({ value: s, label: s.replace('_', ' ') })) },
                { name: 'notes', label: 'Notes', textarea: true },
              ]}
              onSubmit={(v) => insert('pool_equipment', v)}
            />
            {equipment.map((e) => (
              <Card key={e.id as string}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="font-medium">{e.name as string}</p>
                    <p className="text-xs text-muted-foreground">
                      {facilityName(e.facility_id)} · {(e.manufacturer as string) || '—'} {(e.model as string) || ''}
                      {e.warranty_expiration ? ` · warranty ${formatDate(e.warranty_expiration as string)}` : ''}
                    </p>
                  </div>
                  <Badge variant="secondary">{(e.status as string).replace('_', ' ')}</Badge>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ISSUES */}
          <TabsContent value="issues" className="space-y-3">
            <RecordDialog
              title="Log an equipment issue"
              trigger="Add issue"
              fields={[
                { name: 'facility_id', label: 'Facility', required: true, options: facilities.map((f) => ({ value: f.id as string, label: f.name as string })) },
                { name: 'equipment_id', label: 'Equipment (optional)', options: equipment.map((e) => ({ value: e.id as string, label: e.name as string })) },
                { name: 'pool_id', label: 'Pool (optional)', options: pools.map((p) => ({ value: p.id as string, label: p.name as string })) },
                { name: 'title', label: 'Title', required: true },
                { name: 'description', label: 'Description', textarea: true },
                { name: 'severity', label: 'Severity', options: STATUS_OPTIONS.map((s) => ({ value: s, label: s.replace('_', ' ') })) },
                { name: 'status', label: 'Status', options: ISSUE_STATUSES.map((s) => ({ value: s, label: ISSUE_STATUS_LABEL[s] })) },
                { name: 'warranty_claim_reference', label: 'Warranty claim #' },
              ]}
              onSubmit={(v) => insert('equipment_issues', v)}
            />
            {issues.map((i) => (
              <Card key={i.id as string}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{i.title as string}</p>
                      <p className="text-xs text-muted-foreground">{facilityName(i.facility_id)} · opened {formatDate(i.opened_at as string)}</p>
                    </div>
                    <Select
                      value={i.status as string}
                      onValueChange={async (value) => {
                        const { error } = await supabase.from('equipment_issues').update({ status: value as IssueStatus }).eq('id', i.id as string);
                        if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
                        else { toast({ title: 'Issue updated' }); load(); }
                      }}
                    >
                      <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ISSUE_STATUSES.map((s) => <SelectItem key={s} value={s}>{ISSUE_STATUS_LABEL[s]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

/* ---------------- generic create dialog ---------------- */

interface FieldDef {
  name: string;
  label: string;
  required?: boolean;
  textarea?: boolean;
  number?: boolean;
  date?: boolean;
  options?: { value: string; label: string }[];
}

const RecordDialog = ({
  title,
  description,
  trigger,
  fields,
  onSubmit,
}: {
  title: string;
  description?: string;
  trigger: string;
  fields: FieldDef[];
  onSubmit: (values: Record<string, unknown>) => Promise<boolean>;
}) => {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const valid = useMemo(() => fields.every((f) => !f.required || values[f.name]), [fields, values]);

  const submit = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = {};
    fields.forEach((f) => {
      const raw = values[f.name];
      if (raw === undefined || raw === '') return;
      payload[f.name] = f.number ? Number(raw) : raw;
    });
    const ok = await onSubmit(payload);
    setSaving(false);
    if (ok) { setValues({}); setOpen(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" /> {trigger}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.name}>
              <Label htmlFor={f.name} className="text-xs">{f.label}{f.required ? ' *' : ''}</Label>
              {f.options ? (
                <Select value={values[f.name] ?? ''} onValueChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}>
                  <SelectTrigger id={f.name}><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : f.textarea ? (
                <Textarea id={f.name} value={values[f.name] ?? ''} onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))} />
              ) : (
                <Input
                  id={f.name}
                  type={f.date ? 'date' : f.number ? 'number' : 'text'}
                  value={values[f.name] ?? ''}
                  onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!valid || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CommercialAccounts;
