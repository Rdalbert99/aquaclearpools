import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageSquareReply, Plus, RefreshCw, Trash2, UserRound, Wrench } from 'lucide-react';
import { toast } from 'sonner';

type RecipientType = 'assigned_tech' | 'admin_user' | 'tech_user' | 'custom';

interface ForwardingRecipient {
  id: string;
  recipient_type: RecipientType;
  label: string;
  user_id: string | null;
  phone_number: string | null;
  is_enabled: boolean;
  created_at: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: 'admin' | 'tech' | string;
  phone: string | null;
}

const typedSupabase = supabase as any;

const formatRecipientType = (type: RecipientType) => {
  switch (type) {
    case 'assigned_tech':
      return 'Assigned tech';
    case 'admin_user':
      return 'Admin';
    case 'tech_user':
      return 'Tech';
    default:
      return 'Custom';
  }
};

export default function SMSForwardingSettings() {
  const [recipients, setRecipients] = useState<ForwardingRecipient[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addMode, setAddMode] = useState<'team' | 'custom'>('team');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customPhone, setCustomPhone] = useState('');

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [recipientsRes, usersRes] = await Promise.all([
        typedSupabase
          .from('sms_forwarding_recipients')
          .select('*')
          .order('created_at', { ascending: true }),
        typedSupabase
          .from('users')
          .select('id, name, role, phone')
          .in('role', ['admin', 'tech'])
          .order('role', { ascending: true })
          .order('name', { ascending: true }),
      ]);

      if (recipientsRes.error) throw recipientsRes.error;
      if (usersRes.error) throw usersRes.error;

      setRecipients((recipientsRes.data || []) as ForwardingRecipient[]);
      setTeamMembers((usersRes.data || []) as TeamMember[]);
    } catch (error) {
      console.error('Error loading SMS forwarding settings:', error);
      toast.error('Failed to load SMS forwarding settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const teamMemberById = useMemo(() => {
    return new Map(teamMembers.map((member) => [member.id, member]));
  }, [teamMembers]);

  const availableTeamMembers = teamMembers.filter((member) => {
    return !recipients.some((recipient) => recipient.user_id === member.id);
  });

  const addRecipient = async () => {
    setSaving(true);
    try {
      if (addMode === 'team') {
        const member = teamMemberById.get(selectedUserId);
        if (!member) {
          toast.error('Choose an admin or tech');
          return;
        }
        if (!member.phone) {
          toast.error(`${member.name} needs a phone number before replies can be forwarded there`);
          return;
        }

        const { error } = await typedSupabase.from('sms_forwarding_recipients').insert({
          recipient_type: member.role === 'admin' ? 'admin_user' : 'tech_user',
          label: member.name,
          user_id: member.id,
          phone_number: null,
          is_enabled: true,
        });
        if (error) throw error;
        toast.success('Forwarding recipient added');
        setSelectedUserId('');
      } else {
        if (!customLabel.trim() || !customPhone.trim()) {
          toast.error('Enter a name and phone number');
          return;
        }

        const { error } = await typedSupabase.from('sms_forwarding_recipients').insert({
          recipient_type: 'custom',
          label: customLabel.trim(),
          phone_number: customPhone.trim(),
          user_id: null,
          is_enabled: true,
        });
        if (error) throw error;
        toast.success('Forwarding number added');
        setCustomLabel('');
        setCustomPhone('');
      }

      await loadSettings();
    } catch (error) {
      console.error('Error adding SMS forwarding recipient:', error);
      toast.error('Failed to add forwarding recipient');
    } finally {
      setSaving(false);
    }
  };

  const toggleRecipient = async (recipient: ForwardingRecipient) => {
    const { error } = await typedSupabase
      .from('sms_forwarding_recipients')
      .update({ is_enabled: !recipient.is_enabled })
      .eq('id', recipient.id);

    if (error) {
      toast.error('Failed to update forwarding recipient');
      return;
    }

    setRecipients((prev) =>
      prev.map((item) =>
        item.id === recipient.id ? { ...item, is_enabled: !recipient.is_enabled } : item,
      ),
    );
  };

  const deleteRecipient = async (recipient: ForwardingRecipient) => {
    const { error } = await typedSupabase
      .from('sms_forwarding_recipients')
      .delete()
      .eq('id', recipient.id);

    if (error) {
      toast.error('Failed to remove forwarding recipient');
      return;
    }

    setRecipients((prev) => prev.filter((item) => item.id !== recipient.id));
    toast.success('Forwarding recipient removed');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <MessageSquareReply className="h-7 w-7" />
            SMS Reply Forwarding
          </h1>
          <p className="text-muted-foreground text-sm">
            Choose which admins, techs, and phone numbers receive customer text replies.
          </p>
        </div>
        <Button variant="outline" onClick={loadSettings} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forward replies to</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : recipients.length === 0 ? (
            <p className="text-muted-foreground">No forwarding recipients are set up.</p>
          ) : (
            recipients.map((recipient) => {
              const member = recipient.user_id ? teamMemberById.get(recipient.user_id) : null;
              const phone = member?.phone || recipient.phone_number;
              const isAssignedTech = recipient.recipient_type === 'assigned_tech';

              return (
                <div
                  key={recipient.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {recipient.recipient_type === 'tech_user' || isAssignedTech ? (
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <UserRound className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">{isAssignedTech ? 'Customer’s assigned technician' : member?.name || recipient.label}</span>
                      <Badge variant={recipient.is_enabled ? 'secondary' : 'outline'}>
                        {recipient.is_enabled ? 'On' : 'Off'}
                      </Badge>
                      <Badge variant="outline">{formatRecipientType(recipient.recipient_type)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isAssignedTech
                        ? 'Uses the tech assigned to the customer record.'
                        : phone || 'No phone number on file'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={recipient.is_enabled} onCheckedChange={() => toggleRecipient(recipient)} />
                    {!isAssignedTech && (
                      <Button variant="ghost" size="sm" onClick={() => deleteRecipient(recipient)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add recipient</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 max-w-sm">
            <Label>Recipient type</Label>
            <Select value={addMode} onValueChange={(value) => setAddMode(value as 'team' | 'custom')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">Admin or tech</SelectItem>
                <SelectItem value="custom">Custom phone number</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {addMode === 'team' ? (
            <div className="grid gap-2 max-w-sm">
              <Label>Admin or tech</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a team member" />
                </SelectTrigger>
                <SelectContent>
                  {availableTeamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} — {member.role}{member.phone ? ` — ${member.phone}` : ' — no phone'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
              <div className="grid gap-2">
                <Label htmlFor="custom-label">Name</Label>
                <Input
                  id="custom-label"
                  value={customLabel}
                  onChange={(event) => setCustomLabel(event.target.value)}
                  placeholder="Owner phone"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="custom-phone">Phone number</Label>
                <Input
                  id="custom-phone"
                  value={customPhone}
                  onChange={(event) => setCustomPhone(event.target.value)}
                  placeholder="601-555-1234"
                />
              </div>
            </div>
          )}

          <Button onClick={addRecipient} disabled={saving}>
            <Plus className="h-4 w-4 mr-2" /> Add recipient
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}