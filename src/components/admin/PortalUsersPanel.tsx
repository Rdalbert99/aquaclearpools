import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Loader2, Mail, Plus, Trash2 } from 'lucide-react';

interface Row { [key: string]: unknown }

interface Props {
  orgs: Row[];
  facilities: Row[];
  members: Row[];
  users: Row[];
  sends: Row[];
  reload: () => Promise<void>;
}

export function PortalUsersPanel({ orgs, facilities, members, users, sends, reload }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [userId, setUserId] = useState('');
  const [facilityId, setFacilityId] = useState('all');
  const [title, setTitle] = useState('');
  const [role, setRole] = useState('viewer');
  const [monthly, setMonthly] = useState(true);
  const [alerts, setAlerts] = useState(true);

  const orgName = (id: unknown) => (orgs.find((o) => o.id === id)?.name as string) ?? '—';
  const facilityName = (id: unknown) => (facilities.find((f) => f.id === id)?.name as string) ?? '—';
  const userLabel = (id: unknown) => {
    const u = users.find((x) => x.id === id);
    return u ? `${u.name as string} (${u.email as string})` : 'User';
  };

  const existing = useMemo(
    () => new Set(members.map((m) => `${m.organization_id}|${m.user_id}`)),
    [members],
  );

  const grant = async () => {
    if (!orgId || !userId) return;
    setSaving(true);
    const { error } = await supabase.from('commercial_org_users').insert({
      organization_id: orgId,
      user_id: userId,
      facility_id: facilityId === 'all' ? null : facilityId,
      title: title || null,
      role,
      receives_monthly_report: monthly,
      receives_urgent_alerts: alerts,
    } as never);
    setSaving(false);
    if (error) {
      toast({ title: 'Could not grant access', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Portal access granted' });
    setOpen(false);
    setOrgId(''); setUserId(''); setFacilityId('all'); setTitle('');
    await reload();
  };

  const toggleFlag = async (member: Row, field: 'receives_monthly_report' | 'receives_urgent_alerts') => {
    const { error } = await supabase
      .from('commercial_org_users')
      .update({ [field]: !member[field] } as never)
      .eq('id', member.id as string);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    await reload();
  };

  const removeMember = async (id: string) => {
    const { error } = await supabase.from('commercial_org_users').delete().eq('id', id);
    if (error) {
      toast({ title: 'Remove failed', description: error.message, variant: 'destructive' });
      return;
    }
    await reload();
  };

  const sendNow = async (facilityIdValue: string) => {
    setSending(true);
    const { data, error } = await supabase.functions.invoke('send-monthly-executive-summary', {
      body: { mode: 'manual', facility_id: facilityIdValue },
    });
    setSending(false);
    if (error) {
      toast({ title: 'Send failed', description: error.message, variant: 'destructive' });
    } else {
      const results = (data as { results?: { facility: string; status: string; recipients: number; detail?: string }[] })?.results ?? [];
      const summary = results.map((r) => `${r.facility}: ${r.status} (${r.recipients})`).join(' · ');
      toast({ title: 'Monthly summary processed', description: summary || 'No facilities processed' });
    }
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add portal user</Button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Grant portal access</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Read-only Commercial Portal access. The person must already have an Aqua Clear login.
              </p>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Organization *</Label>
                <Select value={orgId} onValueChange={setOrgId}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => <SelectItem key={o.id as string} value={o.id as string}>{o.name as string}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">User account *</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id as string} value={u.id as string}
                        disabled={!!orgId && existing.has(`${orgId}|${u.id}`)}>
                        {u.name as string} ({u.email as string})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Limit to facility</Label>
                  <Select value={facilityId} onValueChange={setFacilityId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All facilities</SelectItem>
                      {facilities.filter((f) => f.organization_id === orgId).map((f) => (
                        <SelectItem key={f.id as string} value={f.id as string}>{f.name as string}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Facilities Director" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={monthly} onCheckedChange={(v) => setMonthly(!!v)} />
                Receives monthly executive summary email
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={alerts} onCheckedChange={(v) => setAlerts(!!v)} />
                Receives urgent alerts
              </label>
            </div>
            <DialogFooter>
              <Button onClick={grant} disabled={!orgId || !userId || saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Grant access
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={sending}>
              {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Mail className="mr-1 h-4 w-4" />}
              Send monthly summary now
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Send monthly summary now</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Sends this month's executive summary to opted-in portal users and billing contacts for the selected facility.
            </p>
            <div className="space-y-2">
              {facilities.map((f) => (
                <div key={f.id as string} className="flex items-center justify-between rounded-md border p-2">
                  <span className="text-sm">{f.name as string} <span className="text-xs text-muted-foreground">· {orgName(f.organization_id)}</span></span>
                  <Button size="sm" variant="secondary" onClick={() => sendNow(f.id as string)} disabled={sending}>Send</Button>
                </div>
              ))}
              {facilities.length === 0 && <p className="text-sm text-muted-foreground">No facilities yet.</p>}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {members.map((m) => (
        <Card key={m.id as string}>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <p className="font-medium">{userLabel(m.user_id)}</p>
              <p className="text-xs text-muted-foreground">
                {orgName(m.organization_id)}{m.facility_id ? ` · ${facilityName(m.facility_id)}` : ' · all facilities'}
                {m.title ? ` · ${m.title as string}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{m.role as string}</Badge>
              <Button size="sm" variant={m.receives_monthly_report ? 'default' : 'outline'}
                onClick={() => toggleFlag(m, 'receives_monthly_report')}>
                Monthly report {m.receives_monthly_report ? 'on' : 'off'}
              </Button>
              <Button size="sm" variant={m.receives_urgent_alerts ? 'default' : 'outline'}
                onClick={() => toggleFlag(m, 'receives_urgent_alerts')}>
                Alerts {m.receives_urgent_alerts ? 'on' : 'off'}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => removeMember(m.id as string)} aria-label="Remove access">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {members.length === 0 && <p className="text-sm text-muted-foreground">No portal users yet.</p>}

      <Card>
        <CardHeader><CardTitle className="text-base">Monthly summary email history</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {sends.length === 0 && <p className="text-muted-foreground">No summaries sent yet. The automatic email goes out on the last day of each month.</p>}
          {sends.map((s) => (
            <div key={s.id as string} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0">
              <span>{facilityName(s.facility_id)} · {s.period_key as string}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {((s.recipients as string[]) ?? []).length} recipients · {s.triggered_by as string}
                </span>
                <Badge variant={s.status === 'sent' ? 'secondary' : 'destructive'}>{s.status as string}</Badge>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
