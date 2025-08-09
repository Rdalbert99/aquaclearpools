import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft,
  Save,
  User,
  Droplets,
  Calendar,
  DollarSign,
  Send
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ClientFormData {
  customer: string;
  pool_size: number;
  pool_type: string;
  liner_type: string;
  status: string;
  in_balance: boolean;
  last_service_date: string;
  user_id: string;
  service_rate: number;
  service_frequency: string;
  next_service_date: string;
  included_services: string[];
  service_notes: string;
  service_days: string[];
}

export default function ClientEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [client, setClient] = useState<ClientFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteEmailEnabled, setInviteEmailEnabled] = useState(true);
  const [inviteSmsEnabled, setInviteSmsEnabled] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);

  useEffect(() => {
    if (id) {
      loadClientData(id);
      loadUsers();
    }
  }, [id]);

  const loadClientData = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (error) throw error;

      setClient({
        customer: data.customer || '',
        pool_size: data.pool_size || 0,
        pool_type: data.pool_type || '',
        liner_type: data.liner_type || 'Liner',
        status: data.status || 'Active',
        in_balance: data.in_balance || false,
        last_service_date: data.last_service_date ? data.last_service_date.split('T')[0] : '',
        user_id: data.user_id || '',
        service_rate: (data as any).service_rate || 0,
        service_frequency: (data as any).service_frequency || 'weekly',
        next_service_date: (data as any).next_service_date ? (data as any).next_service_date.split('T')[0] : '',
        included_services: (data as any).included_services || [],
        service_notes: (data as any).service_notes || '',
        service_days: (data as any).service_days || []
      });

    } catch (error) {
      console.error('Error loading client data:', error);
      toast({
        title: "Error",
        description: "Failed to load client information",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email')
        .order('name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleSave = async () => {
    if (!client || !id) return;

    setSaving(true);
    try {
      console.log('Saving client data:', client);
      console.log('Client ID:', id);
      const updateData: any = {
        customer: client.customer,
        pool_size: client.pool_size,
        pool_type: client.pool_type,
        liner_type: client.liner_type,
        status: client.status,
        in_balance: client.in_balance,
        user_id: client.user_id && client.user_id !== "none" ? client.user_id : null,
        service_rate: client.service_rate,
        service_frequency: client.service_frequency,
        next_service_date: client.next_service_date || null,
        included_services: client.included_services,
        service_notes: client.service_notes,
        service_days: client.service_days,
        updated_at: new Date().toISOString()
      };

      // Only include last_service_date if it's provided
      if (client.last_service_date) {
        updateData.last_service_date = client.last_service_date;
      }

      const { error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client information updated successfully"
      });

      navigate(`/admin/clients/${id}`);

    } catch (error) {
      console.error('Error updating client:', error);
      toast({
        title: "Error",
        description: "Failed to update client information",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof ClientFormData, value: any) => {
    if (!client) return;
    setClient({ ...client, [field]: value });
  };

  const handleServiceToggle = (service: string, checked: boolean) => {
    if (!client) return;
    const updatedServices = checked 
      ? [...client.included_services, service]
      : client.included_services.filter(s => s !== service);
    setClient({ ...client, included_services: updatedServices });
  };

  const handleServiceDayToggle = (day: string, checked: boolean) => {
    if (!client) return;
    const updatedDays = checked 
      ? [...client.service_days, day]
      : client.service_days.filter(d => d !== day);
    setClient({ ...client, service_days: updatedDays });
  };

  const commonPoolServices = [
    'Chemical Testing & Balancing',
    'Skimming Surface Debris',
    'Emptying Skimmer Baskets',
    'Brushing Pool Walls & Steps',
    'Vacuuming Pool Floor',
    'Cleaning Waterline Tile',
    'Backwashing Filter',
    'Equipment Inspection',
    'Pool Equipment Cleaning',
    'Adding Chlorine/Chemicals',
    'Shock Treatment',
    'Algae Prevention',
    'pH Adjustment',
    'Filter Cleaning',
    'Pump Maintenance'
  ];

  const daysOfWeek = [
    'monday',
    'tuesday', 
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
  ];

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-6">
          <Button variant="outline" onClick={() => navigate('/admin/clients')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Button>
        </div>
        <Card>
          <CardContent className="text-center py-8">
            <h3 className="text-lg font-semibold mb-2">Client not found</h3>
            <p className="text-muted-foreground">The requested client could not be found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate(`/admin/clients/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Client
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Client</h1>
            <p className="text-muted-foreground">Update client information and pool details</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => navigate(`/admin/clients/${id}`)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => {
            // Pre-fill invite contacts
            const u = users.find((u) => u.id === client.user_id);
            setInviteEmail(u?.email || '');
            // @ts-ignore
            setInvitePhone((client as any).phone || '');
            setInviteOpen(true);
          }}>
            <Send className="mr-2 h-4 w-4" />
            Send Login Request
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Client Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Customer Name</Label>
              <Input
                id="customer"
                value={client.customer}
                onChange={(e) => handleInputChange('customer', e.target.value)}
                placeholder="Enter customer name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user">Associated User Account</Label>
              <Select value={client.user_id || "none"} onValueChange={(value) => handleInputChange('user_id', value === "none" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user account..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No associated user</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={client.status} onValueChange={(value) => handleInputChange('status', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastService">Last Service Date</Label>
              <Input
                id="lastService"
                type="date"
                value={client.last_service_date}
                onChange={(e) => handleInputChange('last_service_date', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Pool Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Droplets className="h-5 w-5" />
              <span>Pool Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="poolSize">Pool Size (gallons)</Label>
              <Input
                id="poolSize"
                type="number"
                value={client.pool_size || ''}
                onChange={(e) => handleInputChange('pool_size', parseInt(e.target.value) || 0)}
                placeholder="Enter pool size"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="poolType">Pool Type</Label>
              <Select value={client.pool_type} onValueChange={(value) => handleInputChange('pool_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pool type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chlorine">Chlorine</SelectItem>
                  <SelectItem value="Saltwater">Saltwater</SelectItem>
                  <SelectItem value="Salt">Salt</SelectItem>
                  <SelectItem value="Mineral">Mineral</SelectItem>
                  <SelectItem value="Natural">Natural</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="linerType">Liner Type</Label>
              <Select value={client.liner_type} onValueChange={(value) => handleInputChange('liner_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select liner type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Liner">Liner</SelectItem>
                  <SelectItem value="Concrete">Concrete</SelectItem>
                  <SelectItem value="Fiberglass">Fiberglass</SelectItem>
                  <SelectItem value="Vinyl">Vinyl</SelectItem>
                  <SelectItem value="Tile">Tile</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="inBalance"
                checked={client.in_balance}
                onCheckedChange={(checked) => handleInputChange('in_balance', checked)}
              />
              <Label htmlFor="inBalance">Pool is currently in chemical balance</Label>
            </div>
          </CardContent>
        </Card>

        {/* Service Configuration */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5" />
              <span>Service Configuration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceRate">Service Rate ($)</Label>
                <Input
                  id="serviceRate"
                  type="number"
                  step="0.01"
                  value={client.service_rate || ''}
                  onChange={(e) => handleInputChange('service_rate', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="serviceFrequency">Service Frequency</Label>
                <Select value={client.service_frequency} onValueChange={(value) => handleInputChange('service_frequency', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="seasonal">Seasonal</SelectItem>
                    <SelectItem value="as-needed">As Needed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="nextServiceDate">Next Service Date</Label>
                <Input
                  id="nextServiceDate"
                  type="date"
                  value={client.next_service_date}
                  onChange={(e) => handleInputChange('next_service_date', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-semibold">Included Services</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {commonPoolServices.map((service) => (
                  <div key={service} className="flex items-center space-x-2">
                    <Checkbox
                      id={service}
                      checked={client.included_services.includes(service)}
                      onCheckedChange={(checked) => handleServiceToggle(service, checked as boolean)}
                    />
                    <Label 
                      htmlFor={service} 
                      className="text-sm font-normal cursor-pointer"
                    >
                      {service}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-semibold">Service Days</Label>
              <p className="text-sm text-muted-foreground">Select which days of the week this client receives regular service</p>
              <div className="grid grid-cols-7 gap-2">
                {daysOfWeek.map((day) => (
                  <div key={day} className="flex flex-col items-center space-y-2">
                    <Checkbox
                      id={day}
                      checked={client.service_days.includes(day)}
                      onCheckedChange={(checked) => handleServiceDayToggle(day, checked as boolean)}
                    />
                    <Label 
                      htmlFor={day} 
                      className="text-xs font-normal cursor-pointer capitalize"
                    >
                      {day.slice(0, 3)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceNotes">Service Notes</Label>
              <Textarea
                id="serviceNotes"
                value={client.service_notes}
                onChange={(e) => handleInputChange('service_notes', e.target.value)}
                placeholder="Additional notes about service requirements, special instructions, or client preferences..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Login Request</DialogTitle>
            <DialogDescription>Send an invitation to let the client create their account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="inviteEmailEnabled" checked={inviteEmailEnabled} onCheckedChange={(v) => setInviteEmailEnabled(!!v)} />
              <Label htmlFor="inviteEmailEnabled">Send via Email</Label>
            </div>
            {inviteEmailEnabled && (
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="client@example.com" />
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Checkbox id="inviteSmsEnabled" checked={inviteSmsEnabled} onCheckedChange={(v) => setInviteSmsEnabled(!!v)} />
              <Label htmlFor="inviteSmsEnabled">Send via SMS</Label>
            </div>
            {inviteSmsEnabled && (
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} placeholder="+1XXXXXXXXXX" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!id) return;
              if (!inviteEmailEnabled && !inviteSmsEnabled) {
                toast({ title: 'Select a method', description: 'Choose Email or SMS', variant: 'destructive' });
                return;
              }
              setSendingInvite(true);
              try {
                const channels = [
                  inviteEmailEnabled ? 'email' : null,
                  inviteSmsEnabled ? 'sms' : null,
                ].filter(Boolean);
                const { error } = await supabase.functions.invoke('send-client-invite', {
                  body: {
                    clientId: id,
                    email: inviteEmailEnabled ? inviteEmail : undefined,
                    phone: inviteSmsEnabled ? invitePhone : undefined,
                    channels,
                    baseUrl: window.location.origin,
                  },
                });
                if (error) throw error;
                toast({ title: 'Invitation sent', description: 'The client will receive instructions shortly.' });
                setInviteOpen(false);
              } catch (err: any) {
                toast({ title: 'Failed to send', description: err.message || 'Please try again.', variant: 'destructive' });
              } finally {
                setSendingInvite(false);
              }
            }} disabled={sendingInvite}>
              {sendingInvite ? 'Sending...' : 'Send Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}