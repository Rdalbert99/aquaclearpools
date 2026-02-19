import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useUsernameValidation } from '@/hooks/useUsernameValidation';
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
  Send,
  Lock,
  MapPin,
  Mail,
  Phone,
  Wrench,
  Bell,
  Key,
  Plus,
  UserCheck,
  UserX,
  Eye,
  EyeOff
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
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  email: string;
  phone: string;
  notify_on_confirmation: boolean;
  notify_on_assignment: boolean;
  notification_method: string;
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
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [lastTechVisit, setLastTechVisit] = useState<any>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserLogin, setNewUserLogin] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserConfirmPassword, setNewUserConfirmPassword] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  
  const { isValidating: isValidatingUsername, isAvailable: isUsernameAvailable } = useUsernameValidation({
    username: newUserLogin
  });

  useEffect(() => {
    if (id) {
      loadClientData(id);
      loadUsers();
      loadLastTechVisit(id);
    }
  }, [id]);

  const loadClientData = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          users!user_id(id, name, email, phone, address, must_change_password)
        `)
        .eq('id', clientId)
        .single();

      if (error) throw error;

      const userData = (data as any).users;
      
      // Parse address components - try structured fields first, fall back to contact_address
      const streetAddr = userData?.street_address || (data as any).contact_address || '';
      const cityVal = userData?.city || '';
      const stateVal = userData?.state || '';
      const zipVal = userData?.zip_code || '';

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
        service_days: (data as any).service_days || [],
        street_address: streetAddr,
        city: cityVal,
        state: stateVal,
        zip_code: zipVal,
        email: userData?.email || data.contact_email || '',
        phone: userData?.phone || data.contact_phone || '',
        notify_on_confirmation: data.notify_on_confirmation ?? true,
        notify_on_assignment: data.notify_on_assignment ?? true,
        notification_method: data.notification_method || 'email'
      });

      setMustChangePassword(userData?.must_change_password || false);

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

  const loadLastTechVisit = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          users!technician_id(name)
        `)
        .eq('client_id', clientId)
        .order('service_date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading last tech visit:', error);
        return;
      }

      setLastTechVisit(data);
    } catch (error) {
      console.error('Error loading last tech visit:', error);
    }
  };

  const handleSave = async () => {
    if (!client || !id) return;

    console.log('handleSave called - Starting save process...');
    console.log('Client data:', client);
    console.log('Client ID:', id);

    setSaving(true);
    try {
      // Build full address string from components
      const fullAddress = [client.street_address, client.city, client.state, client.zip_code]
        .filter(Boolean)
        .join(', ');

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
        notify_on_confirmation: client.notify_on_confirmation,
        notify_on_assignment: client.notify_on_assignment,
        notification_method: client.notification_method,
        contact_address: fullAddress || null,
        contact_email: client.email || null,
        contact_phone: client.phone || null,
        updated_at: new Date().toISOString()
      };

      // Only include last_service_date if it's provided
      if (client.last_service_date) {
        updateData.last_service_date = client.last_service_date;
      }

      // Update client data
      console.log('Attempting to update client with data:', updateData);
      const { error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', id);

      console.log('Client update result:', { error });
      if (error) throw error;

      // Update user data if there's an associated user
      if (client.user_id && client.user_id !== "none") {
        const { error: userError } = await supabase
          .from('users')
          .update({
            email: client.email,
            phone: client.phone,
            address: fullAddress || null,
            street_address: client.street_address || null,
            city: client.city || null,
            state: client.state || null,
            zip_code: client.zip_code || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', client.user_id);

        if (userError) {
          console.error('Error updating user data:', userError);
          // Don't fail the whole operation if user update fails
        }
      }

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

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
  };

  const generateNewUserPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewUserPassword(password);
    return password;
  };

  const handleCreateUser = async () => {
    if (!newUserLogin || !newUserPassword || !client?.email) return;
    
    if (newUserPassword !== newUserConfirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Password and confirmation do not match.",
        variant: "destructive"
      });
      return;
    }
    
    setCreatingUser(true);
    try {
      const full = (client.customer || '').trim();
      const [firstNameRaw, ...restParts] = full.split(/\s+/);
      const firstName = firstNameRaw || 'Customer';
      const lastName = restParts.join(' ') || 'Account';

      const { data, error } = await supabase.functions.invoke('create-user-account', {
        body: {
          firstName,
          lastName,
          email: client.email,
          login: newUserLogin,
          password: newUserPassword,
          role: 'client',
          phone: client.phone || null,
          address: [client.street_address, client.city, client.state, client.zip_code].filter(Boolean).join(', ') || null
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Link the new user to this client
      const createdUserId = data?.user?.id;
      if (createdUserId) {
        const { error: linkError } = await supabase
          .from('clients')
          .update({ user_id: createdUserId, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (linkError) throw linkError;

        // Update local state
        setClient({ ...client, user_id: createdUserId });
        setMustChangePassword(true);
      }

      toast({
        title: "User Created",
        description: "Login credentials have been created successfully.",
      });

      setShowCreateUser(false);
      setNewUserLogin('');
      setNewUserPassword('');
      setNewUserConfirmPassword('');
      loadUsers(); // Refresh users list
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user account.",
        variant: "destructive",
      });
    } finally {
      setCreatingUser(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!client?.user_id || !newPassword) return;

    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: {
          userId: client.user_id,
          newPassword: newPassword
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Password Reset",
        description: "Password has been reset. User will be required to change it on next login.",
      });

      setShowPasswordDialog(false);
      setNewPassword('');
      setMustChangePassword(true);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reset password.",
        variant: "destructive",
      });
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
          {client.user_id && client.user_id !== "none" && (
            <Button variant="outline" onClick={() => {
              generatePassword();
              setShowPasswordDialog(true);
            }}>
              <Lock className="mr-2 h-4 w-4" />
              Reset Password
            </Button>
          )}
          <Button variant="outline" onClick={() => {
            // Pre-fill invite contacts
            const u = users.find((u) => u.id === client.user_id);
            setInviteEmail(u?.email || client.email);
            setInvitePhone(client.phone || '');
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
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={client.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter email address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={client.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="Enter phone number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="street_address">Street Address</Label>
              <Input
                id="street_address"
                value={client.street_address}
                onChange={(e) => handleInputChange('street_address', e.target.value)}
                placeholder="123 Main St"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={client.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={client.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  placeholder="CA"
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip_code">ZIP Code</Label>
                <Input
                  id="zip_code"
                  value={client.zip_code}
                  onChange={(e) => handleInputChange('zip_code', e.target.value)}
                  placeholder="12345"
                  maxLength={10}
                />
              </div>
            </div>

            {/* Website Login Access Section */}
            <div className="border-2 border-blue-200 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Website Login Access
                </h4>
                {client.user_id && client.user_id !== "none" ? (
                  <div className="flex items-center gap-1 text-green-700">
                    <UserCheck className="w-4 h-4" />
                    <span className="text-sm font-medium">Active</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-orange-700">
                    <UserX className="w-4 h-4" />
                    <span className="text-sm font-medium">No Access</span>
                  </div>
                )}
              </div>
              
              {client.user_id && client.user_id !== "none" ? (
                <div className="space-y-3">
                  <div className="bg-white p-3 rounded border">
                    <div className="text-sm text-muted-foreground mb-1">Current Login Details:</div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {users.find(u => u.id === client.user_id)?.name || 'Loading...'}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({users.find(u => u.id === client.user_id)?.email || client.email})
                      </span>
                    </div>
                    {mustChangePassword && (
                      <p className="text-xs text-amber-600 mt-1">⚠️ Must change password on next login</p>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateUser(true)}
                      className="flex-1"
                    >
                      <User className="w-4 h-4 mr-2" />
                      Update Credentials
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        generatePassword();
                        setShowPasswordDialog(true);
                      }}
                      className="flex-1"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Reset Password
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-orange-50 border border-orange-200 p-3 rounded">
                    <p className="text-sm text-orange-700 mb-2">
                      <strong>No website access configured</strong>
                    </p>
                    <p className="text-xs text-orange-600">
                      Create login credentials so this client can access the customer portal.
                    </p>
                  </div>
                  
                  <Button
                    type="button"
                    onClick={() => setShowCreateUser(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Website Login
                  </Button>
                </div>
              )}
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

        {/* Last Tech Visit */}
        {lastTechVisit && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Wrench className="h-5 w-5" />
                <span>Last Technician Visit</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">Date</Label>
                  <p className="text-sm">{new Date(lastTechVisit.service_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Technician</Label>
                  <p className="text-sm">{lastTechVisit.users?.name || 'Unknown'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Duration</Label>
                  <p className="text-sm">{lastTechVisit.duration_minutes ? `${lastTechVisit.duration_minutes} minutes` : 'Not recorded'}</p>
                </div>
              </div>
              {lastTechVisit.notes && (
                <div className="mt-4">
                  <Label className="text-sm font-medium">Notes</Label>
                  <p className="text-sm text-muted-foreground">{lastTechVisit.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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

        {/* Notification Preferences */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5" />
              <span>Notification Preferences</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="notifyConfirmation"
                  checked={client.notify_on_confirmation}
                  onCheckedChange={(checked) => handleInputChange('notify_on_confirmation', checked)}
                />
                <Label htmlFor="notifyConfirmation">Send notifications when service requests are confirmed/approved</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="notifyAssignment"
                  checked={client.notify_on_assignment}
                  onCheckedChange={(checked) => handleInputChange('notify_on_assignment', checked)}
                />
                <Label htmlFor="notifyAssignment">Send notifications when technicians are assigned</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notificationMethod">Preferred Notification Method</Label>
                <Select value={client.notification_method} onValueChange={(value) => handleInputChange('notification_method', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select notification method..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email Only</SelectItem>
                    <SelectItem value="sms">SMS Only</SelectItem>
                    <SelectItem value="both">Both Email & SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

      {/* Create User Dialog */}
      <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Login Account</DialogTitle>
            <DialogDescription>
              Create login credentials for this client to access their account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newUserLogin">Username</Label>
              <Input
                id="newUserLogin"
                value={newUserLogin}
                onChange={(e) => setNewUserLogin(e.target.value)}
                placeholder="Enter username"
              />
              {isValidatingUsername && (
                <p className="text-xs text-muted-foreground">Checking availability...</p>
              )}
              {newUserLogin.length >= 3 && !isValidatingUsername && (
                <p className={`text-xs ${isUsernameAvailable ? 'text-green-600' : 'text-red-600'}`}>
                  {isUsernameAvailable ? '✓ Username available' : '✗ Username already taken'}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="newUserPassword">Password</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="newUserPassword"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    type={showNewUserPassword ? "text" : "password"}
                    placeholder="Enter password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                  >
                    {showNewUserPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const password = generateNewUserPassword();
                    setNewUserPassword(password);
                    setNewUserConfirmPassword(password);
                  }}
                >
                  Generate
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newUserConfirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="newUserConfirmPassword"
                  value={newUserConfirmPassword}
                  onChange={(e) => setNewUserConfirmPassword(e.target.value)}
                  type={showNewUserPassword ? "text" : "password"}
                  placeholder="Confirm password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                >
                  {showNewUserPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {newUserPassword && newUserConfirmPassword && newUserPassword !== newUserConfirmPassword && (
                <p className="text-xs text-red-600">✗ Passwords do not match</p>
              )}
              {newUserPassword && newUserConfirmPassword && newUserPassword === newUserConfirmPassword && (
                <p className="text-xs text-green-600">✓ Passwords match</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateUser(false);
              setNewUserLogin('');
              setNewUserPassword('');
              setNewUserConfirmPassword('');
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateUser} 
              disabled={creatingUser || !newUserLogin || !newUserPassword || !newUserConfirmPassword || !isUsernameAvailable || newUserPassword !== newUserConfirmPassword}
            >
              {creatingUser ? 'Creating...' : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Generate a new password for this client. They will be required to change it on next login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="flex gap-2">
                <Input
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="text"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generatePassword}
                >
                  Generate
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowPasswordDialog(false);
              setNewPassword('');
            }}>
              Cancel
            </Button>
            <Button onClick={handlePasswordReset} disabled={!newPassword}>
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}