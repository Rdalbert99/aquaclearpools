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
  Navigation,
  ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface ScheduleData {
  todayClients: any[];
  tomorrowClients: any[];
  weekClients: any[];
  pendingRequests: any[];
  weeklySchedule: { [key: string]: any[] };
}

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const shortDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

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

      const todayDayName = daysOfWeek[today.getDay()].toLowerCase();
      const tomorrowDayName = daysOfWeek[tomorrow.getDay()].toLowerCase();

      // Load clients assigned to this technician
      const { data: assignedClients, error: clientsError } = await supabase
        .from('clients')
        .select(`
          *,
          client_user:users!clients_user_id_fkey(name, phone, email, address)
        `)
        .eq('assigned_technician_id', user.id);

      if (clientsError) throw clientsError;

      // Filter clients by service days (all lowercase matching)
      const todayClients = assignedClients?.filter(client => 
        client.service_days?.includes(todayDayName) || 
        client.service_days?.includes(todayDayName.substring(0, 3))
      ) || [];

      const tomorrowClients = assignedClients?.filter(client => 
        client.service_days?.includes(tomorrowDayName) ||
        client.service_days?.includes(tomorrowDayName.substring(0, 3))
      ) || [];

      // Build weekly schedule starting from today for next 7 days
      const weeklySchedule: { [key: string]: any[] } = {};
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dayName = daysOfWeek[date.getDay()];
        const dayNameLower = dayName.toLowerCase();
        const shortDay = dayName.substring(0, 3).toLowerCase();
        
        weeklySchedule[dayName] = assignedClients?.filter(client => 
          client.service_days?.includes(dayNameLower) || 
          client.service_days?.includes(shortDay)
        ) || [];
      }

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

      // Load service requests - both assigned to this tech AND unassigned ones they can accept
      const { data: assignedRequests } = await supabase
        .from('service_requests')
        .select(`
          *,
          clients(customer, pool_type, pool_size)
        `)
        .eq('assigned_technician_id', user.id)
        .in('status', ['pending', 'assigned', 'scheduled'])
        .order('requested_date', { ascending: true });

      // Load unassigned requests that techs can accept
      const { data: unassignedRequests } = await supabase
        .from('service_requests')
        .select(`
          *,
          clients(customer, pool_type, pool_size)
        `)
        .is('assigned_technician_id', null)
        .eq('status', 'pending')
        .order('requested_date', { ascending: true });

      // Combine assigned and unassigned requests
      const allPendingRequests = [...(assignedRequests || []), ...(unassignedRequests || [])];

      // Add service requests to weekly schedule based on preferred_date
      allPendingRequests.forEach(request => {
        if (request.preferred_date) {
          const requestDate = new Date(request.preferred_date);
          const requestDay = daysOfWeek[requestDate.getDay()];
          
          // Check if this day is within our 7-day window
          const today = new Date();
          const daysDiff = Math.floor((requestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff >= 0 && daysDiff < 7) {
            if (!weeklySchedule[requestDay]) {
              weeklySchedule[requestDay] = [];
            }
            // Add request as a special type to distinguish from regular clients
            weeklySchedule[requestDay].push({
              ...request,
              customer: request.contact_name,
              isServiceRequest: true,
              pool_type: request.pool_type || 'Unknown',
              pool_size: request.pool_size || 'Unknown'
            });
          }
        }
      });

      setScheduleData({
        todayClients,
        tomorrowClients,
        weekClients: weekClients.slice(0, 10), // Limit to 10 for display
        pendingRequests: allPendingRequests,
        weeklySchedule
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
            <Link to={`/admin/clients/${client.id}`} className="hover:underline">
              <h3 className="font-semibold text-primary hover:text-primary/80 flex items-center space-x-1">
                <span>{client.customer}</span>
                <ExternalLink className="h-3 w-3" />
              </h3>
            </Link>
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
            {(client.contact_phone || client.client_user?.phone) && (
              <Button size="sm" variant="outline" asChild>
                <a href={`tel:${client.contact_phone || client.client_user?.phone}`}>
                  <Phone className="h-3 w-3 mr-1" />
                  Call
                </a>
              </Button>
            )}
            {(client.contact_address || client.client_user?.address) && (
              <Button size="sm" variant="default" asChild>
                <a 
                  href={`https://maps.apple.com/?q=${encodeURIComponent(client.contact_address || client.client_user?.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Navigation className="h-3 w-3 mr-1" />
                  Map
                </a>
              </Button>
            )}
          </div>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            {(client.contact_address || client.client_user?.address) ? (
              <span className="text-muted-foreground">{client.contact_address || client.client_user?.address}</span>
            ) : (
              <Link to={`/admin/clients/${client.id}`} className="text-xs text-orange-500 hover:underline">
                No address — tap to add
              </Link>
            )}
          </div>
          {client.last_service_date && (
            <div className="flex items-center space-x-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                Last service: {new Date(client.last_service_date).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
        
        <div className="mt-4 flex justify-between">
          <Button size="sm" variant="outline" asChild>
            <Link to={`/admin/clients/${client.id}`}>
              View Client
            </Link>
          </Button>
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
            <SelectItem value="calendar">Weekly Calendar</SelectItem>
            <SelectItem value="overdue">Overdue Clients</SelectItem>
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

      {selectedDay === 'calendar' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Weekly Calendar</span>
            </CardTitle>
            <CardDescription>
              Your client schedule for the week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-4">
              {(() => {
                const today = new Date();
                const weekDays = [];
                for (let i = 0; i < 7; i++) {
                  const date = new Date(today);
                  date.setDate(date.getDate() + i);
                  const dayName = daysOfWeek[date.getDay()];
                  const isToday = i === 0;
                  const clients = scheduleData?.weeklySchedule?.[dayName] || [];
                  
                  weekDays.push(
                    <div key={dayName + i} className={`p-3 rounded-lg border ${isToday ? 'bg-primary/5 border-primary' : 'bg-card'}`}>
                      <h4 className={`font-semibold text-sm mb-2 ${isToday ? 'text-primary' : ''}`}>
                        {dayName}
                        {isToday && <span className="text-xs ml-1">(Today)</span>}
                        <div className="text-xs text-muted-foreground">
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </h4>
                      <div className="space-y-2">
                        {clients.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No clients</p>
                        ) : (
                          clients.map((item, itemIndex) => (
                            <div key={item.id || itemIndex} className="text-xs border rounded p-2 hover:bg-muted/50">
                              {item.isServiceRequest ? (
                                <div>
                                  <Link 
                                    to={`/admin/service-request/${item.id}`}
                                    className="font-medium text-orange-600 hover:underline flex items-center space-x-1"
                                  >
                                    <span>{item.customer} (Request)</span>
                                    <ExternalLink className="h-2 w-2" />
                                  </Link>
                                  <p className="text-muted-foreground truncate">
                                    {item.request_type} - {item.pool_type}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(item.preferred_date).toLocaleDateString()}
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <Link 
                                    to={`/admin/clients/${item.id}`}
                                    className="font-medium text-primary hover:underline flex items-center space-x-1"
                                  >
                                    <span>{item.customer}</span>
                                    <ExternalLink className="h-2 w-2" />
                                  </Link>
                                  {(item.contact_address || item.client_user?.address) ? (
                                    <p className="text-muted-foreground truncate flex items-center space-x-1">
                                      <MapPin className="h-2 w-2 flex-shrink-0" />
                                      <span>{item.contact_address || item.client_user?.address}</span>
                                    </p>
                                  ) : (
                                    <Link to={`/admin/clients/${item.id}`} className="text-[10px] text-orange-500 hover:underline">
                                      No address
                                    </Link>
                                  )}
                                  <p className="text-muted-foreground truncate">
                                    {item.pool_size?.toLocaleString()} gal
                                  </p>
                                    <div className="flex space-x-1 mt-1">
                                      {(item.contact_phone || item.client_user?.phone) && (
                                        <Button size="sm" variant="outline" className="h-6 px-2" asChild>
                                          <a href={`tel:${item.contact_phone || item.client_user?.phone}`} className="text-xs">
                                            <Phone className="h-2 w-2 mr-1" />
                                            Call
                                          </a>
                                        </Button>
                                      )}
                                      {(item.contact_address || item.client_user?.address) && (
                                        <Button size="sm" variant="default" className="h-6 px-2" asChild>
                                          <a 
                                            href={`https://maps.apple.com/?q=${encodeURIComponent(item.contact_address || item.client_user?.address)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs"
                                          >
                                            <Navigation className="h-2 w-2 mr-1" />
                                            Map
                                          </a>
                                        </Button>
                                      )}
                                    </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                }
                return weekDays;
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedDay === 'overdue' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span>Overdue Clients</span>
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
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No service requests at this time</p>
              </div>
            ) : (
              <div className="space-y-4">
                {scheduleData?.pendingRequests.map((request) => (
                  <Card key={request.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <Link 
                            to={`/admin/service-request/${request.id}`}
                            className="hover:underline"
                          >
                            <h3 className="font-semibold text-primary hover:text-primary/80 flex items-center space-x-1">
                              <span>{request.clients?.customer || request.contact_name}</span>
                              <ExternalLink className="h-3 w-3" />
                            </h3>
                          </Link>
                          <p className="text-sm text-muted-foreground mb-2">
                            {request.request_type}
                          </p>
                          <p className="text-sm mb-2">{request.description}</p>
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>Requested: {new Date(request.requested_date).toLocaleDateString()}</span>
                            {request.pool_type && (
                              <span>{request.pool_type} pool</span>
                            )}
                            {request.contact_phone && (
                              <a href={`tel:${request.contact_phone}`} className="text-primary hover:underline">
                                📞 {request.contact_phone}
                              </a>
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