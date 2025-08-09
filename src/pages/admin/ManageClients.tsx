import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Plus, 
  Mail, 
  Phone, 
  Droplets, 
  Calendar, 
  Eye, 
  Edit,
  Trash2,
  MapPin,
  Filter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Client {
  id: string;
  customer: string;
  pool_size: number;
  pool_type: string;
  liner_type: string;
  status: string;
  last_service_date: string | null;
  next_service_date?: string | null;
  service_days?: string[] | null;
  service_frequency?: string | null;
  created_at: string;
  user_id: string;
  assigned_technician_id?: string | null;
  users?: {
    email: string;
    phone: string | null;
    name: string;
  };
  assigned_technician?: {
    id: string;
    name: string;
    email: string;
  };
}

interface Technician {
  id: string;
  name: string;
  email: string;
}

export default function ManageClients() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [poolTypeFilter, setPoolTypeFilter] = useState('all');
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const [selectedClientForTech, setSelectedClientForTech] = useState<Client | null>(null);
  const [selectedTechId, setSelectedTechId] = useState<string>('');
  const [duplicateUserIds, setDuplicateUserIds] = useState<string[]>([]);

  useEffect(() => {
    loadClients();
    loadTechnicians();
    loadDuplicateCandidates();
    
    // Timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('Clients loading timeout - forcing loading to false');
      setLoading(false);
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    filterClients();
  }, [clients, searchTerm, statusFilter, poolTypeFilter]);

  const loadClients = async () => {
    try {
      console.log('Starting client load process...');
      console.log('Current user:', user);
      
      // Test basic Supabase connection first
      console.log('Testing basic Supabase connection...');
      const { data: testData, error: testError } = await supabase
        .from('clients')
        .select('id')
        .limit(1);
      
      console.log('Basic connection test:', { testData, testError });
      
      if (testError) {
        console.error('Basic connection failed:', testError);
        toast({
          title: "Connection Error",
          description: `Database connection failed: ${testError.message}`,
          variant: "destructive",
        });
        return;
      }
      
      // Now try to get all clients with technician data
      console.log('Fetching clients...');
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`
          id, customer, pool_size, pool_type, status, user_id, assigned_technician_id,
          last_service_date, next_service_date, service_days, service_frequency, created_at,
          assigned_technician:users!assigned_technician_id(id, name, email)
        `);
      
      console.log('Clients query result:', { clientsData, clientsError });
      
      if (clientsError) {
        console.error('Clients query failed:', clientsError);
        toast({
          title: "Query Error", 
          description: `Failed to fetch clients: ${clientsError.message}`,
          variant: "destructive",
        });
        return;
      }
      
      console.log(`Found ${clientsData?.length || 0} clients`);
      
      // Set the basic client data for now (without user joins)
      const formattedClients = (clientsData || []).map((client: any) => ({
        ...client,
        liner_type: client.liner_type || 'Liner',
        users: {
          email: 'admin@example.com', // placeholder
          phone: null,
          name: 'Admin User'
        }
      })) || [];
      
      console.log('Setting clients:', formattedClients);
      setClients(formattedClients);
      
    } catch (error) {
      console.error('Unexpected error loading clients:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while loading clients",
        variant: "destructive",
      });
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const loadTechnicians = async () => {
    try {
      let techs: any[] | null = null;
      const { data, error } = await supabase.rpc('get_all_technicians');
      if (!error && data && data.length > 0) {
        techs = data as any[];
      } else {
        const { data: fallback, error: fbErr } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('role', 'tech')
          .order('name');
        if (fbErr) throw fbErr;
        techs = fallback as any[];
      }
      setTechnicians(techs || []);
    } catch (error) {
      console.error('Error loading technicians:', error);
    }
  };

  const loadDuplicateCandidates = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, login, role')
        .in('login', ['Beckama', 'beckama23']);
      if (error) throw error;
      const ids = (data || []).filter((u: any) => u.role === 'client').map((u: any) => u.id);
      setDuplicateUserIds(ids);
    } catch (e) {
      console.error('Error loading duplicate candidates:', e);
    }
  };

  const handleAssignTechnician = async () => {
    if (!selectedClientForTech) return;

    try {
      const techId = selectedTechId === 'unassigned' ? null : selectedTechId;
      
      const { error } = await supabase
        .from('clients')
        .update({ assigned_technician_id: techId })
        .eq('id', selectedClientForTech.id);

      if (error) throw error;

      toast({
        title: "Technician Assigned",
        description: `Technician has been assigned to ${selectedClientForTech.customer}`,
      });

      // Refresh clients list
      loadClients();
      setSelectedClientForTech(null);
      setSelectedTechId('');
    } catch (error) {
      console.error('Error assigning technician:', error);
      toast({
        title: "Error",
        description: "Failed to assign technician",
        variant: "destructive",
      });
    }
  };

  const filterClients = () => {
    let filtered = clients;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(client =>
        client.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.users?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.users?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(client => client.status.toLowerCase() === statusFilter);
    }

    // Pool type filter
    if (poolTypeFilter !== 'all') {
      filtered = filtered.filter(client => client.pool_type.toLowerCase() === poolTypeFilter);
    }

    setFilteredClients(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getServiceStatus = (lastServiceDate: string | null) => {
    if (!lastServiceDate) {
      return { text: 'Never serviced', color: 'bg-red-100 text-red-800' };
    }

    const lastService = new Date(lastServiceDate);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - lastService.getTime()) / (1000 * 3600 * 24));

    if (daysDiff <= 7) {
      return { text: 'Up to date', color: 'bg-green-100 text-green-800' };
    } else if (daysDiff <= 14) {
      return { text: 'Due soon', color: 'bg-yellow-100 text-yellow-800' };
    } else {
      return { text: 'Overdue', color: 'bg-red-100 text-red-800' };
    }
  };

  // Map common day names to JS Date.getDay() index (0=Sun..6=Sat)
  const dayNameToIndex = (name: string): number | null => {
    const n = name.trim().toLowerCase();
    switch (n) {
      case 'sun':
      case 'sunday':
        return 0;
      case 'mon':
      case 'monday':
        return 1;
      case 'tue':
      case 'tues':
      case 'tuesday':
        return 2;
      case 'wed':
      case 'wednesday':
        return 3;
      case 'thu':
      case 'thur':
      case 'thurs':
      case 'thursday':
        return 4;
      case 'fri':
      case 'friday':
        return 5;
      case 'sat':
      case 'saturday':
        return 6;
      default:
        return null;
    }
  };

  const getNextServiceDateFromDays = (serviceDays?: string[] | null): Date | null => {
    if (!serviceDays || serviceDays.length === 0) return null;
    const today = new Date();
    const todayDow = today.getDay();

    let minDiff = 8; // more than a week
    for (const d of serviceDays) {
      const idx = dayNameToIndex(d);
      if (idx == null) continue;
      let diff = (idx - todayDow + 7) % 7;
      if (diff === 0) diff = 7; // next occurrence, not today
      if (diff < minDiff) minDiff = diff;
    }

    if (minDiff === 8) return null;
    const next = new Date(today);
    next.setDate(today.getDate() + minDiff);
    next.setHours(0, 0, 0, 0);
    return next;
  };

  const getNextServiceDateString = (serviceDays?: string[] | null) => {
    const d = getNextServiceDateFromDays(serviceDays);
    return d ? d.toLocaleDateString() : '-';
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      setDeletingClientId(clientId);
      
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

      if (error) {
        console.error('Error deleting client:', error);
        toast({
          title: "Error",
          description: `Failed to delete client: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      // Remove client from local state
      setClients(prev => prev.filter(client => client.id !== clientId));
      
      toast({
        title: "Success",
        description: "Client deleted successfully",
      });
    } catch (error) {
      console.error('Unexpected error deleting client:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while deleting the client",
        variant: "destructive",
      });
    } finally {
      setDeletingClientId(null);
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Clients</h1>
          <p className="text-muted-foreground">View and manage your pool cleaning clients</p>
        </div>
        <Button asChild>
          <Link to="/admin/clients/new">
            <Plus className="mr-2 h-4 w-4" />
            Add New Client
          </Link>
        </Button>
      </div>
      {duplicateUserIds.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div>
                <p className="font-medium">Duplicate accounts detected for "Beckama".</p>
                <p className="text-muted-foreground text-sm">Remove extra client accounts and their linked client records, keeping only the admin.</p>
              </div>
              <Button
                variant="destructive"
                onClick={async () => {
                  try {
                    const { error } = await supabase.functions.invoke('delete-users-and-clients', {
                      body: { userIds: duplicateUserIds },
                    });
                    if (error) throw new Error(error.message || 'Cleanup failed');
                    toast({ title: 'Cleanup complete', description: 'Removed duplicate client accounts.' });
                    setDuplicateUserIds([]);
                    await loadClients();
                  } catch (e: any) {
                    console.error('Cleanup error', e);
                    toast({ title: 'Cleanup failed', description: e.message || 'Please try again.', variant: 'destructive' });
                  }
                }}
              >
                Remove duplicates
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Droplets className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Total Clients</p>
                <p className="text-2xl font-bold">{clients.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-2xl font-bold">{clients.filter(c => c.status === 'Active').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Droplets className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Chlorine Pools</p>
                <p className="text-2xl font-bold">{clients.filter(c => c.pool_type === 'Chlorine').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Droplets className="h-5 w-5 text-teal-500" />
              <div>
                <p className="text-sm font-medium">Salt Pools</p>
                <p className="text-2xl font-bold">{clients.filter(c => c.pool_type === 'Salt').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients, emails, or names..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>

              <Select value={poolTypeFilter} onValueChange={setPoolTypeFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Pool Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="chlorine">Chlorine</SelectItem>
                  <SelectItem value="salt">Salt</SelectItem>
                  <SelectItem value="bromine">Bromine</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setPoolTypeFilter('all');
              }}>
                <Filter className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Clients ({filteredClients.length})</CardTitle>
          <CardDescription>Manage your pool cleaning clients</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredClients.length === 0 ? (
            <div className="text-center py-12">
              <Droplets className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No clients found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all' || poolTypeFilter !== 'all' 
                  ? 'Try adjusting your filters or search terms.'
                  : 'Get started by adding your first client.'
                }
              </p>
              <Button asChild>
                <Link to="/admin/clients/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Client
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-medium">Client</th>
                    <th className="text-left p-4 font-medium">Contact</th>
                    <th className="text-left p-4 font-medium">Pool Details</th>
                    <th className="text-left p-4 font-medium">Assigned Tech</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Last Service</th>
                    <th className="text-left p-4 font-medium">Next Service</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => {
                    const serviceStatus = getServiceStatus(client.last_service_date);
                    return (
                      <tr key={client.id} className="border-b hover:bg-muted/50">
                        <td className="p-4">
                          <div>
                            <p className="font-medium">{client.customer}</p>
                            <p className="text-sm text-muted-foreground">
                              ID: {client.id.slice(0, 8)}...
                            </p>
                          </div>
                        </td>
                        
                        <td className="p-4">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{client.users?.email}</span>
                            </div>
                            {client.users?.phone && (
                              <div className="flex items-center space-x-2">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">{client.users.phone}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        
                        <td className="p-4">
                          <div>
                            <p className="text-sm font-medium">{client.pool_size?.toLocaleString()} gal</p>
                            <p className="text-sm text-muted-foreground">{client.pool_type}</p>
                            <p className="text-xs text-muted-foreground">{client.liner_type}</p>
                          </div>
                        </td>
                        
                        <td className="p-4">
                          <div>
                            {client.assigned_technician ? (
                              <div>
                                <p className="text-sm font-medium">{client.assigned_technician.name}</p>
                                <p className="text-xs text-muted-foreground">{client.assigned_technician.email}</p>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No technician assigned</p>
                            )}
                          </div>
                        </td>
                        
                        <td className="p-4">
                          <Badge className={getStatusColor(client.status)}>
                            {client.status}
                          </Badge>
                        </td>
                        
                        <td className="p-4">
                          <div>
                            <Badge className={serviceStatus.color}>
                              {serviceStatus.text}
                            </Badge>
                            {client.last_service_date && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(client.last_service_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </td>
                        
                        <td className="p-4">
                          <div>
                            <p className="text-sm">{getNextServiceDateString(client.service_days)}</p>
                          </div>
                        </td>
                        
                        <td className="p-4">
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/admin/clients/${client.id}`)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/admin/clients/${client.id}/edit`)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedClientForTech(client);
                                    setSelectedTechId(client.assigned_technician_id || 'unassigned');
                                  }}
                                >
                                  Assign Tech
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Assign Technician</DialogTitle>
                                  <DialogDescription>
                                    Assign a technician to {client.customer}. This technician will receive notifications for service requests.
                                  </DialogDescription>
                                </DialogHeader>
                                
                                <div className="space-y-4">
                                  <Select value={selectedTechId} onValueChange={setSelectedTechId}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a technician" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unassigned">No technician</SelectItem>
                                      {technicians.map((tech) => (
                                        <SelectItem key={tech.id} value={tech.id}>
                                          {tech.name} - {tech.email}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setSelectedClientForTech(null)}>
                                    Cancel
                                  </Button>
                                  <Button onClick={handleAssignTechnician}>
                                    Assign Technician
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  disabled={deletingClientId === client.id}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Client</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{client.customer}"? This action cannot be undone and will permanently remove all associated data including service history.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteClient(client.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}