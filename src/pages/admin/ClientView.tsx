import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { 
  ArrowLeft,
  Edit,
  MapPin,
  Droplets,
  Calendar,
  User,
  Phone,
  Mail,
  CheckCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  TestTube,
  UserPlus,
  Shield,
  Activity,
  MoreVertical
} from 'lucide-react';

interface ClientData {
  client: any;
  services: any[];
  serviceRequests: any[];
  totalRevenue: number;
  lastServiceDate: string | null;
  loginHistory: any[];
  clientUsers: any[];
}

export default function ClientView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showManageUsers, setShowManageUsers] = useState(false);
  const [newUserData, setNewUserData] = useState({ email: '', name: '', password: '', role: 'member' });
  const [userLoading, setUserLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadClientData(id);
    }
  }, [id]);

  const loadClientData = async (clientId: string) => {
    try {
      // Load client details
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select(`
          *,
          users(id, name, email, phone, address)
        `)
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;

      // Load services for this client
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          users(name)
        `)
        .eq('client_id', clientId)
        .order('service_date', { ascending: false });

      if (servicesError) throw servicesError;

      // Load service requests
      const { data: serviceRequests, error: requestsError } = await supabase
        .from('service_requests')
        .select(`
          *,
          users(name)
        `)
        .eq('client_id', clientId)
        .order('requested_date', { ascending: false });

      if (requestsError) throw requestsError;

      // Calculate total revenue
      const totalRevenue = services
        ?.filter(s => s.status === 'completed')
        .reduce((sum, s) => sum + (s.cost || 0), 0) || 0;

      // Get last service date
      const lastServiceDate = services && services.length > 0 
        ? services[0].service_date 
        : null;

      // Load client users
      const { data: clientUsers } = await supabase
        .from('client_users')
        .select(`
          *,
          users(id, name, email, phone, address)
        `)
        .eq('client_id', clientId)
        .order('is_primary', { ascending: false });

      // Load login history for all client users
      let loginHistory = [];
      if (clientUsers && clientUsers.length > 0) {
        const userIds = clientUsers.map(cu => cu.user_id);
        const { data: logins } = await supabase
          .from('user_logins')
          .select('*, users(name)')
          .in('user_id', userIds)
          .order('login_time', { ascending: false })
          .limit(20);
        loginHistory = logins || [];
      }

      setClientData({
        client,
        services: services || [],
        serviceRequests: serviceRequests || [],
        totalRevenue,
        lastServiceDate,
        loginHistory,
        clientUsers: clientUsers || []
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPoolStatus = () => {
    if (!clientData?.lastServiceDate) return 'needs_service';
    const lastService = new Date(clientData.lastServiceDate);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return lastService < weekAgo ? 'needs_service' : 'good';
  };

  const handleCreateUser = async () => {
    setUserLoading(true);
    try {
      // Create user account
      const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
        email: newUserData.email,
        password: newUserData.password,
        email_confirm: true
      });

      if (signUpError) throw signUpError;

      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: newUserData.email,
          name: newUserData.name,
          password: 'temp', // Required field, but not used since auth is handled separately
          role: 'client'
        });

      if (profileError) throw profileError;

      // Link user to client in junction table
      const { error: clientUserError } = await supabase
        .from('client_users')
        .insert({
          client_id: id,
          user_id: authData.user.id,
          role: newUserData.role,
          is_primary: false
        });

      if (clientUserError) throw clientUserError;

      toast({
        title: "Success",
        description: `User account created and linked to client as ${newUserData.role}`
      });

      setShowCreateUser(false);
      setNewUserData({ email: '', name: '', password: '', role: 'member' });
      if (id) loadClientData(id);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive"
      });
    } finally {
      setUserLoading(false);
    }
  };

  const handleResetPassword = async (userEmail?: string) => {
    const emailToReset = userEmail || clientData?.clientUsers?.find(cu => cu.is_primary)?.users?.email;
    
    if (!emailToReset) {
      toast({
        title: "Error",
        description: "No email found for this user",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        emailToReset,
        { redirectTo: `${window.location.origin}/reset-password` }
      );

      if (error) throw error;

      toast({
        title: "Success",
        description: `Password reset email sent to ${emailToReset}`
      });

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email",
        variant: "destructive"
      });
    }
  };

  const handleRemoveUser = async (clientUserId: string) => {
    try {
      const { error } = await supabase
        .from('client_users')
        .delete()
        .eq('id', clientUserId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User removed from client"
      });

      if (id) loadClientData(id);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove user",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!clientData) {
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

  const { client, services, serviceRequests, totalRevenue, loginHistory, clientUsers } = clientData;
  const poolStatus = getPoolStatus();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/admin/clients')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{client.customer}</h1>
            <p className="text-muted-foreground">Client Details & Service History</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreVertical className="mr-2 h-4 w-4" />
                User Management
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setShowCreateUser(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add New User
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowManageUsers(true)}>
                <User className="mr-2 h-4 w-4" />
                Manage Users ({clientUsers.length})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => navigate(`/admin/clients/${client.id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Client
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pool Status</CardTitle>
            {poolStatus === 'good' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {poolStatus === 'good' ? 'Current' : 'Needs Service'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Services</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{services.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {serviceRequests.filter(r => r.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create User Dialog */}
        <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create User Account</DialogTitle>
              <DialogDescription>
                Create a user account for this client to access the portal
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  placeholder="client@example.com"
                />
              </div>
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="password">Temporary Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  placeholder="Enter temporary password"
                />
              </div>
              <div>
                <Label htmlFor="role">User Role</Label>
                <Select value={newUserData.role} onValueChange={(value) => setNewUserData({ ...newUserData, role: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary Contact</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowCreateUser(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateUser} 
                  disabled={userLoading || !newUserData.email || !newUserData.name || !newUserData.password}
                >
                  {userLoading ? <LoadingSpinner /> : 'Create Account'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Manage Users Dialog */}
        <Dialog open={showManageUsers} onOpenChange={setShowManageUsers}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Manage Client Users</DialogTitle>
              <DialogDescription>
                View and manage all users associated with this client
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4">
                {clientUsers.map((clientUser) => (
                  <div key={clientUser.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <h4 className="font-medium">{clientUser.users?.name}</h4>
                        <p className="text-sm text-muted-foreground">{clientUser.users?.email}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant={clientUser.is_primary ? 'default' : 'secondary'}>
                            {clientUser.role}
                          </Badge>
                          {clientUser.is_primary && (
                            <Badge variant="outline">Primary</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetPassword(clientUser.users?.email)}
                      >
                        <Shield className="h-4 w-4 mr-1" />
                        Reset Password
                      </Button>
                      {!clientUser.is_primary && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveUser(clientUser.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {clientUsers.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No users found for this client
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Client Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Client Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Customer Name</p>
              <p className="text-lg">{client.customer}</p>
            </div>
            
            {client.users && (
              <>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Contact Person</p>
                  <p>{client.users.name}</p>
                </div>
                {client.users.email && (
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${client.users.email}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                    >
                      {client.users.email}
                    </a>
                  </div>
                )}
                {client.users.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-900">{client.users.phone}</span>
                      <div className="flex space-x-1">
                        <a
                          href={`tel:${client.users.phone}`}
                          className="inline-flex items-center px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors"
                          title="Call"
                        >
                          📞 Call
                        </a>
                        <a
                          href={`sms:${client.users.phone}`}
                          className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
                          title="Text Message"
                        >
                          💬 Text
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                {client.users.address && (
                  <div className="flex items-start space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.users.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                    >
                      {client.users.address}
                    </a>
                  </div>
                )}
              </>
            )}

            <div className="pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground">Member Since</p>
              <p>{new Date(client.join_date).toLocaleDateString()}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge variant={client.status === 'Active' ? 'default' : 'secondary'}>
                {client.status}
              </Badge>
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
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pool Size</p>
              <p className="text-lg">{client.pool_size?.toLocaleString()} gallons</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pool Type</p>
              <p className="text-lg">{client.pool_type}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Liner Type</p>
              <p>{client.liner_type}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Currently In Balance</p>
              <Badge variant={client.in_balance ? 'default' : 'secondary'}>
                {client.in_balance ? 'Yes' : 'No'}
              </Badge>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Last Service</p>
              <p>{client.last_service_date 
                ? new Date(client.last_service_date).toLocaleDateString()
                : 'No services on record'
              }</p>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Recent Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Recent Services */}
              {services.slice(0, 3).map((service) => (
                <div key={service.id} className="flex items-center space-x-3 p-2 border rounded">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Service Completed</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(service.service_date).toLocaleDateString()} - {service.users?.name}
                    </p>
                  </div>
                  <Badge className={getStatusColor(service.status)}>
                    {service.status}
                  </Badge>
                </div>
              ))}

              {/* Recent Requests */}
              {serviceRequests.slice(0, 2).map((request) => (
                <div key={request.id} className="flex items-center space-x-3 p-2 border rounded">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{request.request_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(request.requested_date).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge className={getStatusColor(request.status)}>
                    {request.status}
                  </Badge>
                </div>
              ))}

              {/* Login History */}
              {clientUsers.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h6 className="text-sm font-medium mb-2 flex items-center">
                    <Shield className="h-4 w-4 mr-2" />
                    Recent Logins ({clientUsers.length} user{clientUsers.length !== 1 ? 's' : ''})
                  </h6>
                  <div className="space-y-2">
                    {loginHistory.length > 0 ? (
                      loginHistory.slice(0, 5).map((login) => (
                        <div key={login.id} className="text-xs text-muted-foreground">
                          <span className="font-medium">{login.users?.name}:</span> {new Date(login.login_time).toLocaleString()}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        No login records yet. Login tracking started recently.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {services.length === 0 && serviceRequests.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Service History</CardTitle>
              <CardDescription>Complete history of pool services</CardDescription>
            </div>
            <Button 
              onClick={() => navigate(`/admin/services/new?client=${client.id}`)}
              className="flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Service</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {services.map((service) => (
              <div key={service.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium">
                      Service - {new Date(service.service_date).toLocaleDateString()}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Technician: {service.users?.name || 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge className={getStatusColor(service.status)}>
                      {service.status}
                    </Badge>
                    {service.cost && (
                      <p className="text-sm font-medium mt-1">${service.cost}</p>
                    )}
                  </div>
                </div>

                {/* Water Chemistry */}
                {(service.ph_level || service.chlorine_level || service.alkalinity_level) && (
                  <div className="bg-gray-50 p-3 rounded mb-3">
                    <h5 className="text-sm font-medium mb-2 flex items-center">
                      <TestTube className="h-4 w-4 mr-2" />
                      Water Chemistry
                    </h5>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                      {service.ph_level && <span>pH: {service.ph_level}</span>}
                      {service.chlorine_level && <span>Cl: {service.chlorine_level} ppm</span>}
                      {service.alkalinity_level && <span>Alk: {service.alkalinity_level} ppm</span>}
                      {service.cyanuric_acid_level && <span>CYA: {service.cyanuric_acid_level} ppm</span>}
                      {service.calcium_hardness_level && <span>CH: {service.calcium_hardness_level} ppm</span>}
                    </div>
                  </div>
                )}

                {/* Chemicals and Notes */}
                <div className="space-y-2 text-sm">
                  {service.chemicals_added && (
                    <div>
                      <span className="font-medium">Chemicals Added: </span>
                      <span>{service.chemicals_added}</span>
                    </div>
                  )}
                  {service.notes && (
                    <div>
                      <span className="font-medium">Notes: </span>
                      <span>{service.notes}</span>
                    </div>
                  )}
                  {service.duration && (
                    <div>
                      <span className="font-medium">Duration: </span>
                      <span>{service.duration} minutes</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {services.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No services on record</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}