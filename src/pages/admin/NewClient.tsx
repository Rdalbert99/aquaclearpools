import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { UsernameInput } from '@/components/ui/username-input';
import { AddressInput } from '@/components/ui/address-input';
import { validateAddress, type AddressComponents } from '@/lib/address-validation';
import { ClientInviteDialog } from '@/components/admin/ClientInviteDialog';
import { 
  ArrowLeft,
  Save,
  User,
  Droplets,
  DollarSign,
  Shuffle,
  Send
} from 'lucide-react';

interface ClientFormData {
  customer: string;
  email: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  address_validated: boolean;
  phone: string;
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
  company_name: string;
  is_multi_property: boolean;
  service_days: string[];
  // New user creation fields
  account_type: 'existing' | 'new' | 'none';
  new_user_username: string;
  new_user_email: string;
  new_user_password: string;
  send_login_email: boolean;
}

export default function NewClient() {
  const navigate = useNavigate();
  const { user, isAdmin, isTech } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [createdClient, setCreatedClient] = useState<any>(null);
  const [client, setClient] = useState<ClientFormData>({
    customer: '',
    email: '',
    street_address: '',
    city: '',
    state: '',
    zip_code: '',
    address_validated: false,
    phone: '',
    pool_size: 0,
    pool_type: '',
    liner_type: 'Liner',
    status: 'Active',
    in_balance: false,
    last_service_date: '',
    user_id: '',
    service_rate: 0,
    service_frequency: 'weekly',
    next_service_date: '',
    included_services: [],
    service_notes: '',
    company_name: '',
    is_multi_property: false,
    service_days: [],
    account_type: 'none',
    new_user_username: '',
    new_user_email: '',
    new_user_password: 'password',
    send_login_email: true
  });

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

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

  const generateRandomPassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setClient({ ...client, new_user_password: password });
  };

  const handleSave = async () => {
    console.log('🚀 Starting handleSave, client data:', client);
    
    if (!client.customer.trim()) {
      toast({
        title: "Error",
        description: "Customer name is required",
        variant: "destructive"
      });
      return;
    }

    if (!client.pool_type) {
      toast({
        title: "Error",
        description: "Pool type is required",
        variant: "destructive"
      });
      return;
    }

    // Validate new user creation fields
    if (isAdmin && client.account_type === 'new') {
      console.log('🔍 Validating new user creation fields...');
      if (!client.new_user_username.trim()) {
        toast({
          title: "Error",
          description: "Username is required for new user account",
          variant: "destructive"
        });
        return;
      }
      if (client.new_user_email && !client.new_user_email.trim()) {
        toast({
          title: "Error",
          description: "Email cannot be empty if provided",
          variant: "destructive"
        });
        return;
      }
      if (!client.new_user_password.trim()) {
        toast({
          title: "Error",
          description: "Password is required for new user account",
          variant: "destructive"
        });
        return;
      }
    }

    setSaving(true);
    try {
      let finalUserId = null;

      // Create new user if requested
      if (isAdmin && client.account_type === 'new') {
        console.log('👤 Creating new user account...');
        console.log('📧 User email:', client.new_user_email);
        
        // First check if email already exists
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('id, email')
          .eq('email', client.new_user_email)
          .maybeSingle();
          
        console.log('🔍 Email check result:', { existingUser, checkError });
        
        if (checkError) {
          console.error('❌ Error checking existing email:', checkError);
          throw checkError;
        }
        
        if (existingUser) {
          console.log('⚠️ Email already exists for user:', existingUser);
          toast({
            title: "Error",
            description: `Email ${client.new_user_email} is already in use. Please use a different email or select the existing user.`,
            variant: "destructive"
          });
          return;
        }
        
        console.log('👤 User name:', client.customer);
        console.log('🔐 User password length:', client.new_user_password.length);
        
        const userInsertData = {
          email: client.new_user_email,
          name: client.customer,
          role: 'client',
          login: client.new_user_username,
          street_address: client.street_address || null,
          city: client.city || null,
          state: client.state || null,
          zip_code: client.zip_code || null,
          address_validated: client.address_validated,
          phone: client.phone || null,
          must_change_password: true
        };
        
        console.log('📝 Inserting user data:', userInsertData);
        
        const { data: userData, error: userError } = await supabase
          .from('users')
          .insert(userInsertData)
          .select()
          .single();

        console.log('✅ User creation result:', { userData, userError });

        if (userError) {
          console.error('❌ User creation failed:', userError);
          throw userError;
        }
        
        finalUserId = userData.id;
        console.log('✅ User created successfully with ID:', finalUserId);

        // TODO: Send login email if requested (requires edge function)
        if (client.send_login_email) {
          console.log('📧 Email sending not implemented yet');
        }
      } else if (client.account_type === 'existing' && client.user_id) {
        console.log('👤 Using existing user ID:', client.user_id);
        finalUserId = client.user_id;
      } else {
        console.log('👤 No user account associated');
      }

      console.log('🏢 Creating client with user ID:', finalUserId);

      const insertData: any = {
        customer: client.customer,
        contact_email: client.email || null,
        contact_phone: client.phone || null,
        contact_address: [client.street_address, client.city, client.state, client.zip_code].filter(Boolean).join(', ') || null,
        pool_size: client.pool_size,
        pool_type: client.pool_type,
        liner_type: client.liner_type,
        status: client.status,
        in_balance: client.in_balance,
        user_id: finalUserId,
        service_rate: client.service_rate,
        service_frequency: client.service_frequency,
        next_service_date: client.next_service_date || null,
        included_services: client.included_services,
        service_notes: client.service_notes,
        service_days: client.service_days,
        company_name: client.company_name || null,
        is_multi_property: client.is_multi_property,
        join_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Auto-assign tech as the technician when they create a client
      if (isTech && user?.id) {
        insertData.assigned_technician_id = user.id;
      }

      // Only include last_service_date if it's provided
      if (client.last_service_date) {
        insertData.last_service_date = client.last_service_date;
      }

      console.log('📝 Inserting client data:', insertData);

      const { data, error } = await supabase
        .from('clients')
        .insert(insertData)
        .select()
        .single();

      console.log('✅ Client creation result:', { data, error });

      if (error) throw error;

      setCreatedClient(data);
      
      toast({
        title: "Success",
        description: "Client created successfully"
      });

      // Show invite dialog if client has email or phone (admin only)
      if (isAdmin && (client.email || client.phone)) {
        setShowInviteDialog(true);
      } else if (isTech) {
        navigate('/tech');
      } else {
        navigate(`/admin/clients/${data.id}`);
      }

    } catch (error) {
      console.error('❌ Error creating client:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      toast({
        title: "Error",
        description: `Failed to create client: ${error.message || error.details || 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof ClientFormData, value: any) => {
    setClient({ ...client, [field]: value });
  };

  const handleAddressValidation = async (addressComponents?: AddressComponents) => {
    if (addressComponents) {
      setClient({
        ...client,
        street_address: addressComponents.street_address,
        city: addressComponents.city,
        state: addressComponents.state,
        zip_code: addressComponents.zip_code,
        address_validated: true
      });
      toast({
        title: "Address Verified",
        description: "Address has been validated and formatted correctly"
      });
    }
  };

  const handleServiceToggle = (service: string, checked: boolean) => {
    const updatedServices = checked 
      ? [...client.included_services, service]
      : client.included_services.filter(s => s !== service);
    setClient({ ...client, included_services: updatedServices });
  };

  const handleServiceDayToggle = (day: string, checked: boolean) => {
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate(isTech ? '/tech' : '/admin/clients')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Add New Client</h1>
            <p className="text-muted-foreground">Create a new client with pool details and service configuration</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => navigate(isTech ? '/tech' : '/admin/clients')}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Creating...' : 'Create Client'}
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
              <Label htmlFor="customer">Customer/Property Name *</Label>
              <Input
                id="customer"
                value={client.customer}
                onChange={(e) => handleInputChange('customer', e.target.value)}
                placeholder="Enter customer/property name"
                required
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Property Address</h3>
              
              <div className="space-y-2">
                <Label htmlFor="street_address">Street Address</Label>
                <AddressInput
                  value={client.street_address}
                  onChange={(value, components) => {
                    handleInputChange('street_address', value);
                    if (components) {
                      handleAddressValidation(components);
                    }
                  }}
                  placeholder="Enter street address"
                  className={client.address_validated ? 'border-green-500' : ''}
                />
                {client.address_validated && (
                  <p className="text-sm text-green-600">✓ Address verified</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    onChange={(e) => handleInputChange('state', e.target.value.toUpperCase())}
                    placeholder="State"
                    maxLength={2}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="zip_code">ZIP Code</Label>
                  <Input
                    id="zip_code"
                    value={client.zip_code}
                    onChange={(e) => handleInputChange('zip_code', e.target.value)}
                    placeholder="ZIP"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address (optional)</Label>
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
                value={client.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="Enter phone number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName">Company/Organization</Label>
              <Input
                id="companyName"
                value={client.company_name}
                onChange={(e) => handleInputChange('company_name', e.target.value)}
                placeholder="e.g. ABC Property Management"
              />
              <p className="text-sm text-muted-foreground">
                Group multiple properties under one organization
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isMultiProperty"
                checked={client.is_multi_property}
                onCheckedChange={(checked) => handleInputChange('is_multi_property', checked)}
              />
              <Label htmlFor="isMultiProperty" className="text-sm">
                Multi-property client (manages multiple pool properties)
              </Label>
            </div>

            {isAdmin && (
            <div className="space-y-4">
              <Label>Associated User Account</Label>
              <div className="space-y-3">
                <Select value={client.account_type} onValueChange={(value: 'existing' | 'new' | 'none') => {
                  setClient({ 
                    ...client, 
                    account_type: value,
                    user_id: value === 'existing' ? client.user_id : '',
                    new_user_username: value === 'new' ? client.new_user_username : '',
                    new_user_email: value === 'new' ? client.new_user_email : '',
                    new_user_password: value === 'new' ? client.new_user_password : ''
                  });
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose account option..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No associated user</SelectItem>
                    <SelectItem value="existing">Select existing user</SelectItem>
                    <SelectItem value="new">Create new user account</SelectItem>
                  </SelectContent>
                </Select>

                {client.account_type === 'existing' && (
                  <Select value={client.user_id || ""} onValueChange={(value) => handleInputChange('user_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {client.account_type === 'new' && (
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                    <div className="space-y-2">
                      <Label htmlFor="newUserUsername">Username</Label>
                      <UsernameInput
                        id="newUserUsername"
                        value={client.new_user_username}
                        onChange={(e) => handleInputChange('new_user_username', e.target.value)}
                        placeholder="Choose a unique username"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="newUserEmail">Client Email</Label>
                      <Input
                        id="newUserEmail"
                        type="email"
                        value={client.new_user_email}
                        onChange={(e) => handleInputChange('new_user_email', e.target.value)}
                        placeholder="Enter client's email (optional)"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="newUserPassword">Password *</Label>
                      <div className="flex space-x-2">
                        <Input
                          id="newUserPassword"
                          type="password"
                          value={client.new_user_password}
                          onChange={(e) => handleInputChange('new_user_password', e.target.value)}
                          placeholder="Enter password"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={generateRandomPassword}
                        >
                          <Shuffle className="h-4 w-4 mr-1" />
                          Generate
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="sendLoginEmail"
                        checked={client.send_login_email}
                        onCheckedChange={(checked) => handleInputChange('send_login_email', checked)}
                      />
                      <Label htmlFor="sendLoginEmail" className="text-sm">
                        Automatically send customer email to change password and login
                      </Label>
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}

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
              <Label htmlFor="poolSize">Pool Size (gallons) *</Label>
              <Input
                id="poolSize"
                type="number"
                value={client.pool_size || ''}
                onChange={(e) => handleInputChange('pool_size', parseInt(e.target.value) || 0)}
                placeholder="e.g. 15000"
                min="1000"
                max="100000"
              />
              <p className="text-sm text-muted-foreground">
                Enter the approximate pool capacity in gallons
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="poolType">Water Type *</Label>
              <Select value={client.pool_type} onValueChange={(value) => handleInputChange('pool_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select water type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chlorine">Chlorine Pool</SelectItem>
                  <SelectItem value="Salt">Salt Water Pool</SelectItem>
                  <SelectItem value="Mineral">Mineral Pool</SelectItem>
                  <SelectItem value="Natural">Natural Pool</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Choose the primary water treatment system
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="linerType">Pool Surface</Label>
              <Select value={client.liner_type} onValueChange={(value) => handleInputChange('liner_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pool surface..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Concrete">Concrete/Gunite</SelectItem>
                  <SelectItem value="Fiberglass">Fiberglass</SelectItem>
                  <SelectItem value="Liner">Vinyl Liner</SelectItem>
                  <SelectItem value="Tile">Tile</SelectItem>
                  <SelectItem value="Pebble">Pebble Tec</SelectItem>
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
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Included Services</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allSelected = commonPoolServices.every(s => client.included_services.includes(s));
                    handleInputChange('included_services', allSelected ? [] : [...commonPoolServices]);
                  }}
                >
                  {commonPoolServices.every(s => client.included_services.includes(s)) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
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

      {/* Bottom Save Button */}
      <div className="flex justify-end space-x-2 pb-8">
        <Button variant="outline" onClick={() => navigate(isTech ? '/tech' : '/admin/clients')}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Creating...' : 'Save Client'}
        </Button>
      </div>

      {/* Client Invite Dialog */}
      {createdClient && (
        <ClientInviteDialog
          open={showInviteDialog}
          onOpenChange={(open) => {
            setShowInviteDialog(open);
            if (!open) {
              navigate(`/admin/clients/${createdClient.id}`);
            }
          }}
          client={{
            id: createdClient.id,
            customer: createdClient.customer,
            email: createdClient.contact_email,
            phone: createdClient.contact_phone
          }}
        />
      )}
    </div>
  );
}