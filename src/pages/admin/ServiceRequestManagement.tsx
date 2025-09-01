import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  Clock, 
  MapPin, 
  User,
  AlertTriangle,
  CheckCircle,
  Users,
  CalendarIcon,
  Bell,
  BellOff
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

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
  const isAdmin = (user as any)?.role === 'admin';
  const { toast } = useToast();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [scheduleDates, setScheduleDates] = useState<Record<string, Date>>({});
  const [datePickerOpen, setDatePickerOpen] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<'all' | 'pending' | 'assigned' | 'scheduled' | 'completed'>('all');
  const [completedFilterDate, setCompletedFilterDate] = useState<string>('');
  const [notificationOptions, setNotificationOptions] = useState<Record<string, { sendEmail: boolean, sendSMS: boolean }>>({});

  useEffect(() => {
    loadData();

    // Realtime updates for new/updated service requests
    const channel = supabase
      .channel('service-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'service_requests' }, () => loadData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'service_requests' }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

      // Load technicians (admin-only via RPC with fallback)
      let techs: any[] | null = null;
      const { data: techData, error: techError } = await supabase.rpc('get_all_technicians');
      if (!techError && techData && techData.length > 0) {
        techs = techData as any[];
      } else {
        const { data: fallbackTechs, error: fallbackErr } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('role', 'tech')
          .order('name');
        if (fallbackErr) {
          console.error('Error loading technicians:', fallbackErr);
        } else {
          techs = fallbackTechs as any[];
        }
      }
      setTechnicians(techs || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const assignTechnician = async (requestId: string, technicianId: string) => {
    setAssigning(requestId);
    try {
      // Get request details first
      const { data: requestData, error: fetchError } = await supabase
        .from('service_requests')
        .select(`
          *,
          client_id,
          clients(notify_on_assignment, notification_method, contact_email, contact_phone, customer)
        `)
        .eq('id', requestId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching request details:', fetchError);
        toast({
          title: "Error",
          description: "Failed to fetch request details",
          variant: "destructive",
        });
        return;
      }

      if (!requestData) {
        toast({
          title: "Error",
          description: "Service request not found",
          variant: "destructive",
        });
        return;
      }

      // Get technician details
      const { data: techData, error: techError } = await supabase
        .from('users')
        .select('name, email, phone')
        .eq('id', technicianId)
        .single();

      if (techError) {
        console.error('Error fetching technician details:', techError);
      }

      // Update assignment
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
          description: `Failed to assign technician: ${error.message}`,
          variant: "destructive",
        });
      } else {
        // Send notification if client preferences allow and client exists
        const clientData = requestData.clients;
        const notifyOptions = notificationOptions[requestId];
        
        if (clientData?.notify_on_assignment && (notifyOptions?.sendEmail || notifyOptions?.sendSMS)) {
          try {
            await supabase.functions.invoke('service-request-notify', {
              body: {
                requestId,
                customerName: clientData.customer,
                customerEmail: notifyOptions?.sendEmail ? clientData.contact_email : undefined,
                customerPhone: notifyOptions?.sendSMS ? clientData.contact_phone : undefined,
                serviceType: requestData.request_type,
                status: 'assigned',
                technicianName: techData?.name,
                technicianPhone: techData?.phone,
                notes: requestData.description,
              }
            });
          } catch (emailErr) {
            console.error('Email notification error:', emailErr);
          }
        }

        toast({
          title: "Success",
          description: "Technician assigned successfully",
        });
        loadData();
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setAssigning(null);
    }
  };

  const approveRequest = async (requestId: string) => {
    try {
      // Get request details first
      const { data: requestData, error: fetchError } = await supabase
        .from('service_requests')
        .select(`
          *,
          client_id,
          clients(notify_on_confirmation, notification_method, contact_email, contact_phone, customer)
        `)
        .eq('id', requestId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching request details:', fetchError);
        toast({ title: 'Error', description: 'Failed to fetch request details', variant: 'destructive' });
        return;
      }

      if (!requestData) {
        toast({ title: 'Error', description: 'Service request not found', variant: 'destructive' });
        return;
      }

      const { error } = await supabase
        .from('service_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (error) {
        console.error('Error approving request:', error);
        toast({ title: 'Error', description: 'Failed to approve request', variant: 'destructive' });
      } else {
        // Send notification if client preferences allow and client exists
        const clientData = requestData.clients;
        const notifyOptions = notificationOptions[requestId];
        
        if (clientData?.notify_on_confirmation && (notifyOptions?.sendEmail || notifyOptions?.sendSMS)) {
          try {
            await supabase.functions.invoke('service-request-notify', {
              body: {
                requestId,
                customerName: clientData.customer,
                customerEmail: notifyOptions?.sendEmail ? clientData.contact_email : undefined,
                customerPhone: notifyOptions?.sendSMS ? clientData.contact_phone : undefined,
                serviceType: requestData.request_type,
                status: 'approved',
                notes: requestData.description,
              }
            });
          } catch (emailErr) {
            console.error('Email notification error:', emailErr);
          }
        }

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
      const iso = date.toISOString();
      
      // First, get the current request details for the email notification
      const { data: requestData, error: fetchError } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError) {
        console.error('Error fetching request details:', fetchError);
        toast({ title: 'Error', description: 'Failed to fetch request details', variant: 'destructive' });
        return;
      }

      // Fetch assigned technician details (name and phone) if available
      let technicianName: string | undefined;
      let technicianPhone: string | undefined;
      if (requestData.assigned_technician_id) {
        const { data: techData, error: techErr } = await supabase
          .from('users')
          .select('name, phone')
          .eq('id', requestData.assigned_technician_id)
          .single();
        if (!techErr && techData) {
          technicianName = techData.name as string | undefined;
          technicianPhone = techData.phone as string | undefined;
        }
      }

      // Update the preferred date in the database
      const { error } = await supabase
        .from('service_requests')
        .update({ preferred_date: iso, status: 'scheduled' })
        .eq('id', requestId);
        
      if (error) {
        console.error('Error scheduling request:', error);
        toast({ title: 'Error', description: 'Failed to schedule date', variant: 'destructive' });
      } else {
        // Send email notification to customer
        try {
          const { error: emailError } = await supabase.functions.invoke('service-request-notify', {
            body: {
              requestId,
              customerName: requestData.contact_name,
              customerEmail: requestData.contact_email,
              serviceType: requestData.request_type,
              status: 'scheduled',
              scheduledDate: iso,
              notes: requestData.description,
              technicianName,
              technicianPhone,
            }
          });

          if (emailError) {
            console.error('Error sending email notification:', emailError);
            // Don't show error to user for email failures, just log it
          }
        } catch (emailErr) {
          console.error('Email notification error:', emailErr);
          // Don't show error to user for email failures, just log it
        }

        toast({ title: 'Scheduled', description: 'Service date scheduled and customer notified' });
        loadData();
      }
    } catch (err) {
      console.error('Schedule error:', err);
    }
  };

  const deleteRequest = async (requestId: string) => {
    if (!isAdmin) return;
    const confirmed = window.confirm('Delete this service request? This cannot be undone.');
    if (!confirmed) return;
    try {
      const { error } = await supabase
        .from('service_requests')
        .delete()
        .eq('id', requestId);
      if (error) {
        console.error('Error deleting request:', error);
        toast({ title: 'Error', description: 'Failed to delete request', variant: 'destructive' });
      } else {
        toast({ title: 'Deleted', description: 'Service request removed' });
        loadData();
      }
    } catch (err) {
      console.error('Delete error:', err);
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

  const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const pendingRequests = requests.filter(r => !r.assigned_technician_id && r.status !== 'completed');
  const assignedRequests = requests.filter(r => !!r.assigned_technician_id && !r.preferred_date && r.status !== 'completed');
  const scheduledRequests = requests.filter(r => !!r.preferred_date && r.status !== 'completed');
  const completedRequests = requests.filter(r => r.status === 'completed').filter(r => {
    const completedAt = r.completed_date ? new Date(r.completed_date) : undefined;
    if (!completedAt) return false;
    if (completedFilterDate) {
      return isSameDay(completedAt, new Date(completedFilterDate));
    }
    return completedAt >= oneDayAgo;
  });

  const allRequestsFiltered = requests.filter(r => {
    if (r.status !== 'completed') return true;
    const completedAt = r.completed_date ? new Date(r.completed_date) : undefined;
    if (!completedAt) return false;
    return completedAt >= oneDayAgo;
  });

  const filteredRequests = (
    filter === 'all' ? allRequestsFiltered :
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
        {filter === 'completed' && (
          <div className="flex items-center gap-2">
            <Input type="date" value={completedFilterDate || ''} onChange={(e) => setCompletedFilterDate(e.target.value)} />
            <Button variant="outline" size="sm" onClick={() => setCompletedFilterDate('')}>Clear</Button>
          </div>
        )}
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
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => approveRequest(request.id)}>Approve</Button>
                          <Popover 
                            open={datePickerOpen[request.id] || false} 
                            onOpenChange={(open) => setDatePickerOpen({ ...datePickerOpen, [request.id]: open })}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "justify-start text-left font-normal",
                                  !scheduleDates[request.id] && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {scheduleDates[request.id] ? (
                                  format(scheduleDates[request.id], "PPP")
                                ) : (
                                  <span>Pick date</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={scheduleDates[request.id]}
                                onSelect={(date) => {
                                  if (date) {
                                    setScheduleDates({ ...scheduleDates, [request.id]: date });
                                    setDatePickerOpen({ ...datePickerOpen, [request.id]: false });
                                  }
                                }}
                                disabled={(date) => date < new Date()}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                          <Button variant="outline" size="sm" onClick={() => scheduleRequest(request.id)}>
                            Schedule
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Checkbox
                            id={`email-${request.id}`}
                            checked={notificationOptions[request.id]?.sendEmail ?? true}
                            onCheckedChange={(checked) => 
                              setNotificationOptions(prev => ({
                                ...prev,
                                [request.id]: { ...prev[request.id], sendEmail: !!checked }
                              }))
                            }
                          />
                          <Label htmlFor={`email-${request.id}`} className="text-xs">Email</Label>
                          <Checkbox
                            id={`sms-${request.id}`}
                            checked={notificationOptions[request.id]?.sendSMS ?? false}
                            onCheckedChange={(checked) => 
                              setNotificationOptions(prev => ({
                                ...prev,
                                [request.id]: { ...prev[request.id], sendSMS: !!checked }
                              }))
                            }
                          />
                          <Label htmlFor={`sms-${request.id}`} className="text-xs">SMS</Label>
                        </div>
                      </div>
                    )}
                    {request.status !== 'pending' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Popover 
                            open={datePickerOpen[request.id] || false} 
                            onOpenChange={(open) => setDatePickerOpen({ ...datePickerOpen, [request.id]: open })}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "justify-start text-left font-normal",
                                  !scheduleDates[request.id] && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {scheduleDates[request.id] ? (
                                  format(scheduleDates[request.id], "PPP")
                                ) : (
                                  <span>Pick date</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={scheduleDates[request.id]}
                                onSelect={(date) => {
                                  if (date) {
                                    setScheduleDates({ ...scheduleDates, [request.id]: date });
                                    setDatePickerOpen({ ...datePickerOpen, [request.id]: false });
                                  }
                                }}
                                disabled={(date) => date < new Date()}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                          <Button variant="outline" size="sm" onClick={() => scheduleRequest(request.id)}>
                            Schedule
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Checkbox
                            id={`schedule-email-${request.id}`}
                            checked={notificationOptions[request.id]?.sendEmail ?? true}
                            onCheckedChange={(checked) => 
                              setNotificationOptions(prev => ({
                                ...prev,
                                [request.id]: { ...prev[request.id], sendEmail: !!checked }
                              }))
                            }
                          />
                          <Label htmlFor={`schedule-email-${request.id}`} className="text-xs">Email</Label>
                          <Checkbox
                            id={`schedule-sms-${request.id}`}
                            checked={notificationOptions[request.id]?.sendSMS ?? false}
                            onCheckedChange={(checked) => 
                              setNotificationOptions(prev => ({
                                ...prev,
                                [request.id]: { ...prev[request.id], sendSMS: !!checked }
                              }))
                            }
                          />
                          <Label htmlFor={`schedule-sms-${request.id}`} className="text-xs">SMS</Label>
                        </div>
                      </div>
                    )}
                    {!request.assigned_technician_id && (
                      <div className="space-y-2">
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
                        <div className="flex items-center gap-2 text-xs">
                          <Checkbox
                            id={`assign-email-${request.id}`}
                            checked={notificationOptions[request.id]?.sendEmail ?? true}
                            onCheckedChange={(checked) => 
                              setNotificationOptions(prev => ({
                                ...prev,
                                [request.id]: { ...prev[request.id], sendEmail: !!checked }
                              }))
                            }
                          />
                          <Label htmlFor={`assign-email-${request.id}`} className="text-xs">Email</Label>
                          <Checkbox
                            id={`assign-sms-${request.id}`}
                            checked={notificationOptions[request.id]?.sendSMS ?? false}
                            onCheckedChange={(checked) => 
                              setNotificationOptions(prev => ({
                                ...prev,
                                [request.id]: { ...prev[request.id], sendSMS: !!checked }
                              }))
                            }
                          />
                          <Label htmlFor={`assign-sms-${request.id}`} className="text-xs">SMS</Label>
                        </div>
                      </div>
                    )}
                    {assigning === request.id && <LoadingSpinner />}
                    {isAdmin && (
                      <Button variant="destructive" size="sm" onClick={() => deleteRequest(request.id)}>
                        Delete
                      </Button>
                    )}
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