import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { 
  Calendar, 
  Search, 
  Filter, 
  DollarSign, 
  Clock, 
  User, 
  MapPin,
  TestTube,
  FileText,
  Plus,
  Download
} from 'lucide-react';

interface Service {
  id: string;
  service_date: string;
  duration: number;
  cost: number;
  status: string;
  ph_level: number;
  chlorine_level: number;
  alkalinity_level: number;
  cyanuric_acid_level: number;
  calcium_hardness_level: number;
  chemicals_added: string;
  notes: string;
  created_at: string;
  clients?: {
    id: string;
    customer: string;
    pool_size: number;
    pool_type: string;
  };
  users?: {
    id: string;
    name: string;
  };
}

export default function ServiceHistory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [techFilter, setTechFilter] = useState('all');
  const [technicians, setTechnicians] = useState<any[]>([]);

  useEffect(() => {
    loadServices();
    loadTechnicians();
  }, []);

  useEffect(() => {
    filterServices();
  }, [services, searchTerm, statusFilter, dateFilter, techFilter]);

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          clients(id, customer, pool_size, pool_type),
          users(id, name)
        `)
        .order('service_date', { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error loading services:', error);
      toast({
        title: "Error",
        description: "Failed to load service history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .in('role', ['admin', 'tech'])
        .order('name');

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error) {
      console.error('Error loading technicians:', error);
    }
  };

  const filterServices = () => {
    let filtered = [...services];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(service =>
        service.clients?.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.users?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(service => service.status === statusFilter);
    }

    // Technician filter
    if (techFilter !== 'all') {
      filtered = filtered.filter(service => service.users?.id === techFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(service => 
            new Date(service.service_date) >= filterDate
          );
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter(service => 
            new Date(service.service_date) >= filterDate
          );
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter(service => 
            new Date(service.service_date) >= filterDate
          );
          break;
        case 'quarter':
          filterDate.setMonth(now.getMonth() - 3);
          filtered = filtered.filter(service => 
            new Date(service.service_date) >= filterDate
          );
          break;
      }
    }

    setFilteredServices(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTotalRevenue = () => {
    return filteredServices
      .filter(service => service.status === 'completed')
      .reduce((total, service) => total + (service.cost || 0), 0);
  };

  const exportToCSV = () => {
    const csvContent = [
      ['Date', 'Client', 'Technician', 'Status', 'Duration (min)', 'Cost', 'pH', 'Chlorine', 'Alkalinity', 'Notes'],
      ...filteredServices.map(service => [
        new Date(service.service_date).toLocaleDateString(),
        service.clients?.customer || '',
        service.users?.name || '',
        service.status,
        service.duration || '',
        service.cost || '',
        service.ph_level || '',
        service.chlorine_level || '',
        service.alkalinity_level || '',
        service.notes?.replace(/,/g, ';') || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `service-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <Calendar className="h-8 w-8 text-blue-600" />
            <span>Service History</span>
          </h1>
          <p className="text-muted-foreground">Complete record of all pool services</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={exportToCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button asChild>
            <Link to="/admin/services/new">
              <Plus className="mr-2 h-4 w-4" />
              New Service
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Services</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredServices.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredServices.filter(s => s.status === 'completed').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${getTotalRevenue().toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Service Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredServices.length > 0 
                ? Math.round(filteredServices.reduce((sum, s) => sum + (s.duration || 0), 0) / filteredServices.length)
                : 0
              } min
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients, techs, notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="quarter">Last 3 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Technician</label>
              <Select value={techFilter} onValueChange={setTechFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Technicians</SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services List */}
      <div className="space-y-4">
        {filteredServices.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No services found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or create a new service</p>
            </CardContent>
          </Card>
        ) : (
          filteredServices.map((service) => (
            <Card key={service.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    {/* Header Row */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{service.clients?.customer || 'Unknown Client'}</span>
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {service.clients?.pool_size?.toLocaleString()} gal {service.clients?.pool_type} pool
                        </p>
                      </div>
                      <Badge className={getStatusColor(service.status)}>
                        {service.status}
                      </Badge>
                    </div>

                    {/* Service Details Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{new Date(service.service_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{service.users?.name || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{service.duration ? `${service.duration} min` : 'N/A'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>{service.cost ? `$${service.cost}` : 'N/A'}</span>
                      </div>
                    </div>

                    {/* Water Chemistry */}
                    {(service.ph_level || service.chlorine_level || service.alkalinity_level) && (
                      <div className="flex items-center space-x-4 text-sm bg-gray-50 p-3 rounded-lg">
                        <TestTube className="h-4 w-4 text-muted-foreground" />
                        <div className="flex space-x-6">
                          {service.ph_level && <span>pH: {service.ph_level}</span>}
                          {service.chlorine_level && <span>Cl: {service.chlorine_level} ppm</span>}
                          {service.alkalinity_level && <span>Alk: {service.alkalinity_level} ppm</span>}
                          {service.cyanuric_acid_level && <span>CYA: {service.cyanuric_acid_level} ppm</span>}
                          {service.calcium_hardness_level && <span>CH: {service.calcium_hardness_level} ppm</span>}
                        </div>
                      </div>
                    )}

                    {/* Chemicals Added */}
                    {service.chemicals_added && (
                      <div className="text-sm">
                        <span className="font-medium text-muted-foreground">Chemicals: </span>
                        <span>{service.chemicals_added}</span>
                      </div>
                    )}

                    {/* Notes */}
                    {service.notes && (
                      <div className="text-sm">
                        <div className="flex items-start space-x-2">
                          <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <span className="text-muted-foreground">{service.notes}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}