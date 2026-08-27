import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search, ShieldCheck } from 'lucide-react';

interface UserRow { id: string; name: string; email: string }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  facilityId?: string | null;
  facilityName?: string | null;
  onFinished?: () => void;
}

export function CommercialPortalInviteDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  facilityId,
  facilityName,
  onFinished,
}: Props) {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [scope, setScope] = useState<'org' | 'facility'>('org');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from('users')
      .select('id, name, email')
      .order('name')
      .then(({ data }) => setUsers((data as UserRow[]) ?? []));
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users.slice(0, 25);
    return users
      .filter((u) => (u.name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q))
      .slice(0, 25);
  }, [users, search]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const save = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    const rows = selected.map((user_id) => ({
      organization_id: organizationId,
      user_id,
      facility_id: scope === 'facility' ? facilityId ?? null : null,
      role: 'viewer' as const,
    }));
    const { error } = await supabase.from('commercial_org_users').insert(rows);
    setSaving(false);
    if (error) {
      toast({ title: 'Could not grant access', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Portal access granted',
      description: `${rows.length} user${rows.length > 1 ? 's' : ''} added as read-only viewer${rows.length > 1 ? 's' : ''}.`,
    });
    setSelected([]);
    onOpenChange(false);
    onFinished?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite Commercial Portal User</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Grant management users read-only access to {organizationName}. They must already have an Aqua Clear login.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
            Portal users are read-only. They can never edit chemistry, chemical additions, technician notes, services or equipment history.
          </div>

          {facilityId && (
            <div className="space-y-2">
              <Label>Access scope</Label>
              <Select value={scope} onValueChange={(v: 'org' | 'facility') => setScope(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="org">Entire organization ({organizationName})</SelectItem>
                  <SelectItem value="facility">Only {facilityName || 'this facility'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Find users</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
            {filtered.length === 0 && <p className="p-2 text-sm text-muted-foreground">No matching users.</p>}
            {filtered.map((u) => (
              <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-muted/60">
                <Checkbox checked={selected.includes(u.id)} onCheckedChange={() => toggle(u.id)} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{u.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                </span>
              </label>
            ))}
          </div>

          {selected.length > 0 && <Badge variant="secondary">{selected.length} selected</Badge>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Skip for now</Button>
          <Button onClick={save} disabled={saving || selected.length === 0}>
            {saving ? 'Granting…' : 'Grant read-only access'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
