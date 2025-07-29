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

interface Client {
  id: string;
  customer: string;
  pool_size: number;
  pool_type: string;
  liner_type: string;
  status: string;
  last_service_date: string | null;
  created_at: string;
  user_id: string;
  users?: {
    email: string;
    phone: string | null;
    name: string;
  };
}

export default function ManageClients() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [poolTypeFilter, setPoolTypeFilter] = useState('all');

  useEffect(() => {
    loadClients();
    
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
      console.log('Loading clients...');
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          users(email, phone, name)
        `)
        .order('customer');

      if (error) {
        console.error('Error loading clients:', error);
        toast({
          title: "Error",
          description: "Failed to load clients",
          variant: "destructive",
        });
      } else {
        console.log('Clients loaded:', data);
        setClients(data || []);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
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
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Last Service</th>
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
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => {
                                // TODO: Add delete confirmation dialog
                                console.log('Delete client:', client.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
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