import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock, 
  MapPin, 
  User,
  AlertTriangle,
  CheckCircle,
  Users
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ServiceRequest {
  id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
  request_type: string;
  priority: string;
  status: string;
  description: string;
  requested_date: string;
  assigned_technician_id: string | null;
  assigned_technician?: {
    name: string;
  };
  started_at?: string;
  preferred_date?: string | null;
  completed_date?: string;
}

interface Technician {
  id: string;
  name: string;
  email: string;
}

export default function ServiceRequestManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [scheduleDates, setScheduleDates] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'all' | 'pending' | 'assigned' | 'scheduled' | 'completed'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load service requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('service_requests')
        .select(`
          *,
          assigned_technician:users!assigned_technician_id(name)
        `)
        .order('requested_date', { ascending: false });

      if (requestsError) {
        console.error('Error loading requests:', requestsError);
        toast({
          title: "Error",
          description: "Failed to load service requests",
          variant: "destructive",
        });
      } else {
        setRequests(requestsData || []);
      }

      // Load technicians
      const { data: techData, error: techError } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('role', 'tech');

      if (techError) {
        console.error('Error loading technicians:', techError);
      } else {
        setTechnicians(techData || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const assignTechnician = async (requestId: string, technicianId: string) => {
    setAssigning(requestId);
    try {
      const { error } = await supabase
        .from('service_requests')
        .update({ 
          assigned_technician_id: technicianId,
          status: 'assigned'
        })
        .eq('id', requestId);

      if (error) {
        console.error('Error assigning technician:', error);
        toast({
          title: "Error",
          description: "Failed to assign technician",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Technician assigned successfully",
        });
        loadData(); // Reload data
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setAssigning(null);
    }
  };

  const approveRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('service_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (error) {
        console.error('Error approving request:', error);
        toast({ title: 'Error', description: 'Failed to approve request', variant: 'destructive' });
      } else {
        toast({ title: 'Approved', description: 'Service request approved' });
        loadData();
      }
    } catch (err) {
      console.error('Approve error:', err);
    }
  };

  const scheduleRequest = async (requestId: string) => {
    const date = scheduleDates[requestId];
    if (!date) {
      toast({ title: 'Date required', description: 'Please pick a service date', variant: 'destructive' });
      return;
    }
    try {
      const iso = new Date(date).toISOString();
      const { error } = await supabase
        .from('service_requests')
        .update({ preferred_date: iso })
        .eq('id', requestId);
      if (error) {
        console.error('Error scheduling request:', error);
        toast({ title: 'Error', description: 'Failed to schedule date', variant: 'destructive' });
      } else {
        toast({ title: 'Scheduled', description: 'Preferred service date set' });
        loadData();
      }
    } catch (err) {
      console.error('Schedule error:', err);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'assigned': return 'default';
      case 'in_progress': return 'default';
      case 'completed': return 'default';
      default: return 'secondary';
    }
  };

  const formatDuration = (startedAt?: string, completedDate?: string) => {
    if (!startedAt || !completedDate) return 'N/A';
    
    const start = new Date(startedAt);
    const end = new Date(completedDate);
    const durationMs = end.getTime() - start.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
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

  
  const pendingRequests = requests.filter(r => !r.assigned_technician_id);
  const assignedRequests = requests.filter(r => !!r.assigned_technician_id && !r.preferred_date && r.status !== 'completed');
  const scheduledRequests = requests.filter(r => !!r.preferred_date && r.status !== 'completed');
  const completedRequests = requests.filter(r => r.status === 'completed');

  const filteredRequests = (
    filter === 'all' ? requests :
    filter === 'pending' ? pendingRequests :
    filter === 'assigned' ? assignedRequests :
    filter === 'scheduled' ? scheduledRequests :
    completedRequests
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Service Request Management</h1>
          <p className="text-muted-foreground">Manage and assign service requests to technicians</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card onClick={() => setFilter('pending')} className={`cursor-pointer ${filter === 'pending' ? 'ring-2 ring-primary' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests.length}</div>
          </CardContent>
        </Card>
        <Card onClick={() => setFilter('assigned')} className={`cursor-pointer ${filter === 'assigned' ? 'ring-2 ring-primary' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignedRequests.length}</div>
          </CardContent>
        </Card>
        <Card onClick={() => setFilter('scheduled')} className={`cursor-pointer ${filter === 'scheduled' ? 'ring-2 ring-primary' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduledRequests.length}</div>
          </CardContent>
        </Card>
        <Card onClick={() => setFilter('completed')} className={`cursor-pointer ${filter === 'completed' ? 'ring-2 ring-primary' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedRequests.length}</div>
          </CardContent>
        </Card>
      </div>


      <div className="flex flex-wrap items-center gap-2">
        <Button variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>All Service Requests</Button>
        <Button variant={filter === 'pending' ? 'default' : 'outline'} onClick={() => setFilter(filter === 'pending' ? 'all' : 'pending')}>Pending</Button>
        <Button variant={filter === 'assigned' ? 'default' : 'outline'} onClick={() => setFilter(filter === 'assigned' ? 'all' : 'assigned')}>Assigned</Button>
        <Button variant={filter === 'scheduled' ? 'default' : 'outline'} onClick={() => setFilter(filter === 'scheduled' ? 'all' : 'scheduled')}>Scheduled</Button>
        <Button variant={filter === 'completed' ? 'default' : 'outline'} onClick={() => setFilter(filter === 'completed' ? 'all' : 'completed')}>Completed</Button>
      </div>

      {/* Service Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>All Service Requests</CardTitle>
          <CardDescription>View and manage all service requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <div key={request.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                  <div className="md:col-span-2">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{request.contact_name || 'Unknown'}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{request.contact_email}</p>
                    <p className="text-sm text-muted-foreground">{request.contact_phone}</p>
                  </div>
                  
                  <div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{request.request_type}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{request.contact_address}</p>
                    <p className="text-xs text-muted-foreground mt-1">{request.description}</p>
                  </div>

                  <div className="space-y-1">
                    <Badge variant={getPriorityColor(request.priority)}>
                      {request.priority} priority
                    </Badge>
                    <Badge variant={getStatusColor(request.status)}>
                      {request.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {new Date(request.requested_date).toLocaleDateString()}
                    </p>
                  </div>

                  <div>
                    {request.assigned_technician ? (
                      <div>
                        <p className="text-sm font-medium">{request.assigned_technician.name}</p>
                        {request.started_at && (
                          <p className="text-xs text-muted-foreground">
                            Duration: {formatDuration(request.started_at, request.completed_date)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Unassigned</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    {request.status === 'pending' && (
                      <Button size="sm" onClick={() => approveRequest(request.id)}>Approve</Button>
                    )}
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={scheduleDates[request.id] || ''}
                        onChange={(e) => setScheduleDates({ ...scheduleDates, [request.id]: e.target.value })}
                      />
                      <Button variant="outline" size="sm" onClick={() => scheduleRequest(request.id)}>
                        Schedule
                      </Button>
                    </div>
                    {!request.assigned_technician_id && (
                      <Select
                        onValueChange={(techId) => assignTechnician(request.id, techId)}
                        disabled={assigning === request.id}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Assign Tech" />
                        </SelectTrigger>
                        <SelectContent>
                          {technicians.map((tech) => (
                            <SelectItem key={tech.id} value={tech.id}>
                              {tech.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {assigning === request.id && <LoadingSpinner />}
                  </div>
                </div>
              </div>
            ))}
            {filteredRequests.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No service requests found</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}