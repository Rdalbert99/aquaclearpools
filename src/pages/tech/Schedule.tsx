import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Phone,
  Droplets,
  CheckCircle,
  AlertTriangle,
  User,
  Navigation
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface ScheduleData {
  todayClients: any[];
  tomorrowClients: any[];
  weekClients: any[];
  pendingRequests: any[];
}

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TechSchedule() {
  const { user } = useAuth();
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState('today');

  useEffect(() => {
    loadScheduleData();
  }, [user]);

  const loadScheduleData = async () => {
    if (!user?.id) return;

    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const todayDayName = daysOfWeek[today.getDay()];
      const tomorrowDayName = daysOfWeek[tomorrow.getDay()];

      // Load clients assigned to this technician
      const { data: assignedClients, error: clientsError } = await supabase
        .from('clients')
        .select(`
          *,
          users(name, phone, email, address)
        `)
        .eq('assigned_technician_id', user.id);

      if (clientsError) throw clientsError;

      // Filter clients by service days
      const todayClients = assignedClients?.filter(client => 
        client.service_days?.includes(todayDayName) || 
        client.service_days?.includes(todayDayName.substring(0, 3).toLowerCase())
      ) || [];

      const tomorrowClients = assignedClients?.filter(client => 
        client.service_days?.includes(tomorrowDayName) ||
        client.service_days?.includes(tomorrowDayName.substring(0, 3).toLowerCase())
      ) || [];

      // Get clients needing service (no service in last 7 days)
      const { data: recentServices } = await supabase
        .from('services')
        .select('client_id, service_date')
        .eq('technician_id', user.id)
        .gte('service_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const recentClientIds = recentServices?.map(s => s.client_id) || [];
      const weekClients = assignedClients?.filter(client => 
        !recentClientIds.includes(client.id)
      ) || [];

      // Load pending service requests assigned to this tech
      const { data: pendingRequests } = await supabase
        .from('service_requests')
        .select(`
          *,
          clients(customer, pool_type, pool_size)
        `)
        .eq('assigned_technician_id', user.id)
        .in('status', ['pending', 'assigned'])
        .order('requested_date', { ascending: true });

      setScheduleData({
        todayClients,
        tomorrowClients,
        weekClients: weekClients.slice(0, 10), // Limit to 10 for display
        pendingRequests: pendingRequests || []
      });
    } catch (error) {
      console.error('Error loading schedule data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getServicePriority = (client: any) => {
    if (!client.last_service_date) return 'high';
    
    const lastService = new Date(client.last_service_date);
    const daysSince = Math.floor((Date.now() - lastService.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSince >= 14) return 'high';
    if (daysSince >= 10) return 'medium';
    return 'low';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const renderClientCard = (client: any, showPriority = false) => (
    <Card key={client.id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold">{client.customer}</h3>
            <p className="text-sm text-muted-foreground">
              {client.pool_size?.toLocaleString()} gal • {client.pool_type}
            </p>
            {showPriority && (
              <Badge variant={getPriorityColor(getServicePriority(client))} className="mt-1">
                {getServicePriority(client)} priority
              </Badge>
            )}
          </div>
          <div className="flex space-x-1">
            {client.users?.phone && (
              <Button size="sm" variant="outline" asChild>
                <a href={`tel:${client.users.phone}`}>
                  <Phone className="h-3 w-3" />
                </a>
              </Button>
            )}
            {client.users?.address && (
              <Button size="sm" variant="outline" asChild>
                <a 
                  href={`https://maps.google.com?q=${encodeURIComponent(client.users.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Navigation className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        </div>
        
        <div className="space-y-2 text-sm">
          {client.users?.address && (
            <div className="flex items-center space-x-2">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{client.users.address}</span>
            </div>
          )}
          {client.last_service_date && (
            <div className="flex items-center space-x-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                Last service: {new Date(client.last_service_date).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
        
        <div className="mt-4 flex justify-end">
          <Button size="sm" asChild>
            <Link to={`/tech/service/${client.id}`}>
              Start Service
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );

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
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <Calendar className="h-8 w-8" />
            <span>Service Schedule</span>
          </h1>
          <p className="text-muted-foreground">Your daily and weekly service schedule</p>
        </div>
        <Select value={selectedDay} onValueChange={setSelectedDay}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today's Schedule</SelectItem>
            <SelectItem value="tomorrow">Tomorrow's Schedule</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="requests">Service Requests</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{scheduleData?.todayClients.length}</p>
                <p className="text-sm text-muted-foreground">Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{scheduleData?.tomorrowClients.length}</p>
                <p className="text-sm text-muted-foreground">Tomorrow</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{scheduleData?.weekClients.length}</p>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{scheduleData?.pendingRequests.length}</p>
                <p className="text-sm text-muted-foreground">Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Content */}
      {selectedDay === 'today' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5" />
              <span>Today's Schedule</span>
            </CardTitle>
            <CardDescription>
              Clients scheduled for service today ({new Date().toLocaleDateString()})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scheduleData?.todayClients.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No clients scheduled for today</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scheduleData?.todayClients.map(client => renderClientCard(client, true))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedDay === 'tomorrow' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Tomorrow's Schedule</span>
            </CardTitle>
            <CardDescription>
              Clients scheduled for service tomorrow
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scheduleData?.tomorrowClients.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No clients scheduled for tomorrow</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scheduleData?.tomorrowClients.map(client => renderClientCard(client))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedDay === 'week' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span>Clients Needing Service</span>
            </CardTitle>
            <CardDescription>
              Clients who haven't been serviced recently
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scheduleData?.weekClients.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <p className="text-muted-foreground">All clients are up to date!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scheduleData?.weekClients.map(client => renderClientCard(client, true))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedDay === 'requests' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Service Requests</span>
            </CardTitle>
            <CardDescription>
              Pending service requests assigned to you
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scheduleData?.pendingRequests.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <p className="text-muted-foreground">No pending service requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {scheduleData?.pendingRequests.map((request) => (
                  <Card key={request.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold">
                            {request.clients?.customer || request.contact_name}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            {request.request_type}
                          </p>
                          <p className="text-sm mb-2">{request.description}</p>
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>Requested: {new Date(request.requested_date).toLocaleDateString()}</span>
                            {request.pool_type && (
                              <span>{request.pool_type} pool</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={request.priority === 'high' ? 'destructive' : 'secondary'}>
                            {request.priority}
                          </Badge>
                          <Button size="sm" asChild>
                            <Link to={`/admin/service-request/${request.id}`}>
                              View Details
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}