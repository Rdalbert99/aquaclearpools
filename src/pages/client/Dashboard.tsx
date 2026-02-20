import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  Calendar, 
  Droplets, 
  CheckCircle,
  AlertCircle,
  Plus,
  FileText,
  Camera,
  Phone,
  User,
  MessageCircle,
  Clock,
  Star,
  TestTube
} from 'lucide-react';
import { YourPoolSection } from '@/components/client/YourPoolSection';
import { ProfilePictureUpload } from '@/components/client/ProfilePictureUpload';
import { TechnicianMessageDialog } from '@/components/client/TechnicianMessageDialog';
import { ReviewDialog } from '@/components/client/ReviewDialog';
import { isInRange, CHEMICAL_RANGES, type ChemicalId } from '@/lib/pool-chemistry';

interface ClientDashboardData {
  client: any;
  nextService: any;
  lastService: any;
  pendingRequests: any[];
  assignedTechnician: any;
  userProfile: any;
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<ClientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    console.log('Loading dashboard data for user:', user?.id, 'role:', user?.role);
    
    if (!user?.id) {
      console.log('No user ID found, cannot load dashboard data');
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching client profile for user_id:', user.id);
      
      // Load user profile for profile image
      const { data: userProfile } = await supabase
        .from('users')
        .select('profile_image_url')
        .eq('id', user.id)
        .maybeSingle();
      
      // Load client profile
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('Client query result:', { client, error: clientError });

      if (clientError) {
        console.error('Error loading client:', clientError);
        setLoading(false);
        return;
      }

      if (!client) {
        console.log('No client record found for user_id:', user.id);
        setLoading(false);
        return;
      }

      console.log('Client found:', client.customer, 'ID:', client.id);

      // Load assigned technician details
      let assignedTechnician = null;
      if (client.assigned_technician_id) {
        console.log('Loading technician details for ID:', client.assigned_technician_id);
        const { data: techData, error: techError } = await supabase
          .from('users')
          .select('id, name, email, phone, profile_image_url')
          .eq('id', client.assigned_technician_id)
          .eq('role', 'tech')
          .maybeSingle();
        
        if (techError) {
          console.error('Error loading technician:', techError);
        } else {
          assignedTechnician = techData;
          console.log('Technician loaded:', techData?.name);
        }
      }

      // Load last service with technician details
      console.log('Loading last service for client_id:', client.id);
      const { data: lastService, error: serviceError } = await supabase
        .from('services')
        .select(`
          *,
          users(name, email),
          clients(customer)
        `)
        .eq('client_id', client.id)
        .order('service_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (serviceError) {
        console.error('Error loading last service:', serviceError);
      } else {
        console.log('Last service loaded:', lastService);
      }

      // Load pending service requests
      console.log('Loading pending requests for client_id:', client.id);
      const { data: pendingRequests, error: requestsError } = await supabase
        .from('service_requests')
        .select('*')
        .eq('client_id', client.id)
        .eq('status', 'pending')
        .order('requested_date', { ascending: false });

      if (requestsError) {
        console.error('Error loading pending requests:', requestsError);
      } else {
        console.log('Pending requests loaded:', pendingRequests?.length || 0);
      }

      const dashboardData = {
        client,
        nextService: client.next_service_date,
        lastService: lastService || null,
        pendingRequests: pendingRequests || [],
        assignedTechnician,
        userProfile
      };
      
      console.log('Setting dashboard data:', dashboardData);
      setDashboardData(dashboardData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  console.log('ClientDashboard render - loading:', loading, 'user:', user?.id, 'role:', user?.role, 'dashboardData:', !!dashboardData);

  if (loading) {
    console.log('Showing loading spinner');
    return <LoadingSpinner />;
  }

  if (!dashboardData?.client) {
    console.log('No client data found, showing welcome message');
    return (
      <div className="p-6">
        <Card>
          <CardContent className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Welcome to Pool Management</h2>
            <p className="text-muted-foreground mb-6">
              It looks like your client profile hasn't been set up yet. Please contact your pool service provider to complete your profile setup.
            </p>
            <Button asChild>
              <Link to="/contact">
                <Phone className="h-4 w-4 mr-2" />
                Contact Support
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { client } = dashboardData;
  console.log('Client data found:', client.customer, 'checking for missing pool info');
  
  // Check if essential pool information is missing
  const missingPoolInfo = !client.pool_size || !client.pool_type || !client.liner_type;
  console.log('Missing pool info check:', { 
    pool_size: client.pool_size, 
    pool_type: client.pool_type, 
    liner_type: client.liner_type, 
    missingPoolInfo 
  });
  
  if (missingPoolInfo) {
    console.log('Showing missing pool info setup screen');
    return (
      <div className="p-6">
        <Card>
          <CardContent className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Welcome! Let's Set Up Your Pool</h2>
            <p className="text-muted-foreground mb-6">
              To provide you with the best service, we need some basic information about your pool.
            </p>
            <div className="space-y-2 mb-6">
              <p className="text-sm text-muted-foreground">We need to know:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {!client.pool_size && <Badge variant="outline">Pool Size (gallons)</Badge>}
                {!client.pool_type && <Badge variant="outline">Pool Type (Chlorine/Salt Water)</Badge>}
                {!client.liner_type && <Badge variant="outline">Liner Type</Badge>}
              </div>
            </div>
            <div className="space-y-3">
              <Button asChild>
                <Link to="/client/profile">
                  <Plus className="h-4 w-4 mr-2" />
                  Update Pool Information
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Phone className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  console.log('Rendering full client dashboard for:', client.customer);
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {user?.name}</h1>
          <p className="text-muted-foreground">
            Here's your pool information and quick actions
          </p>
        </div>
      </div>

      {/* Pool Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Droplets className="h-5 w-5" />
            <span>Your Pool Details</span>
          </CardTitle>
          <CardDescription>Current pool configuration and information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Pool Size</p>
              <p className="text-lg font-semibold">{client.pool_size?.toLocaleString()} gallons</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Water Type</p>
              <p className="text-lg font-semibold">{client.pool_type}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Liner Type</p>
              <p className="text-lg font-semibold">{client.liner_type}</p>
            </div>
          </div>
          
          {client.service_frequency && (
            <div className="mt-6 pt-6 border-t">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Service Frequency</p>
                <p className="text-lg font-semibold capitalize">{client.service_frequency}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Your Pool Section */}
      <YourPoolSection 
        clientId={client.id}
        currentImageUrl={client.pool_image_url}
        onImageUpdated={loadDashboardData}
      />

      {/* Profile Picture Section */}
      <ProfilePictureUpload 
        currentImageUrl={dashboardData?.userProfile?.profile_image_url}
        onImageUpdated={loadDashboardData}
      />

      {/* Technician Information */}
      {dashboardData?.assignedTechnician && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5 text-blue-500" />
              <span>Your Technician</span>
            </CardTitle>
            <CardDescription>Your assigned pool service technician</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                {dashboardData.assignedTechnician.profile_image_url ? (
                  <img 
                    src={dashboardData.assignedTechnician.profile_image_url} 
                    alt={dashboardData.assignedTechnician.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-6 w-6" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{dashboardData.assignedTechnician.name}</p>
                <p className="text-sm text-muted-foreground">{dashboardData.assignedTechnician.email}</p>
                {dashboardData.assignedTechnician.phone && (
                  <p className="text-sm text-muted-foreground">{dashboardData.assignedTechnician.phone}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Service Appointment */}
      {client.next_service_date && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-green-500" />
              <span>Next Scheduled Service</span>
            </CardTitle>
            <CardDescription>Your upcoming pool service appointment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">
                  {new Date(client.next_service_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {dashboardData.assignedTechnician 
                    ? `with ${dashboardData.assignedTechnician.name}`
                    : 'Technician to be assigned'
                  }
                </p>
              </div>
              <Badge variant="outline">Scheduled</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Service Information */}
      {dashboardData?.lastService && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Last Service</span>
            </CardTitle>
            <CardDescription>Your most recent pool service details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Service Date</p>
                  <p className="font-medium">
                    {new Date(dashboardData.lastService.service_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Technician</p>
                  <p className="font-medium">
                    {dashboardData.lastService.users?.name || 'Unknown Technician'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">
                    {dashboardData.lastService.duration_minutes 
                      ? `${dashboardData.lastService.duration_minutes} minutes`
                      : 'Not recorded'}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                {dashboardData.lastService.services_performed && (
                  <div>
                    <p className="text-sm text-muted-foreground">Services Performed</p>
                    <p className="font-medium">{dashboardData.lastService.services_performed}</p>
                  </div>
                )}
                {dashboardData.lastService.chemicals_added && (
                  <div>
                    <p className="text-sm text-muted-foreground">Chemicals Added</p>
                    <p className="font-medium">{dashboardData.lastService.chemicals_added}</p>
                  </div>
                )}
                {dashboardData.lastService.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Service Notes</p>
                    <p className="font-medium">{dashboardData.lastService.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Chemical Readings */}
            {(() => {
              const readings = dashboardData.lastService.readings as Record<string, number | null> | null;
              const ph = readings?.ph ?? dashboardData.lastService.ph_level;
              const fc = readings?.fc ?? dashboardData.lastService.chlorine_level;
              const ta = readings?.ta ?? dashboardData.lastService.alkalinity_level;
              const cya = readings?.cya ?? dashboardData.lastService.cyanuric_acid_level;
              const salt = readings?.salt ?? null;

              const items: { id: ChemicalId; label: string; value: number | null }[] = [
                { id: 'ph', label: 'pH', value: ph },
                { id: 'chlorine', label: 'Free Chlorine', value: fc },
                { id: 'alkalinity', label: 'Alkalinity', value: ta },
                { id: 'cya', label: 'CYA', value: cya },
                { id: 'salt', label: 'Salt', value: salt },
              ];

              const hasAny = items.some(i => i.value != null);
              if (!hasAny) return null;

              return (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="text-sm font-semibold flex items-center gap-1 mb-3">
                    <TestTube className="h-4 w-4" /> Chemical Readings
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {items.map(({ id, label, value }) => {
                      if (value == null) return null;
                      const status = isInRange(id, value);
                      const range = CHEMICAL_RANGES[id];
                      return (
                        <div key={id} className={`p-3 rounded-lg border text-center ${
                          status === 'in' ? 'border-green-300 bg-green-50 text-green-800' 
                          : 'border-red-300 bg-red-50 text-red-800'
                        }`}>
                          <p className="text-xs font-medium">{label}</p>
                          <p className="text-lg font-bold">{value}{range.unit ? ` ${range.unit}` : ''}</p>
                          <p className="text-xs">
                            {status === 'in' ? '✓ In Range' : '⚠ Out of Range'}
                          </p>
                          <p className="text-[10px] opacity-70">{range.min}–{range.max}{range.unit ? ` ${range.unit}` : ''}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Payment Information */}
      {client.qb_invoice_link && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              <span>Payment Information</span>
            </CardTitle>
            <CardDescription>Your invoice and payment details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Invoice Ready</p>
                <p className="text-sm text-muted-foreground">
                  Your latest service invoice is available for payment
                </p>
              </div>
              <Button asChild>
                <a
                  href={client.qb_invoice_link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Pay Invoice
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>What would you like to do today?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button asChild className="h-16 text-left flex-col items-start p-4">
              <Link to="/client/request-service">
                <div className="flex items-center space-x-2 mb-1">
                  <Plus className="h-5 w-5" />
                  <span className="font-semibold">Request Service</span>
                </div>
                <span className="text-sm opacity-80">Schedule a pool service or report an issue</span>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-16 text-left flex-col items-start p-4">
              <Link to="/client/services">
                <div className="flex items-center space-x-2 mb-1">
                  <FileText className="h-5 w-5" />
                  <span className="font-semibold">Service History</span>
                </div>
                <span className="text-sm opacity-80">View past services and chemical readings</span>
              </Link>
            </Button>
            
            <ReviewDialog clientId={client.id} />
            
            {dashboardData?.assignedTechnician && (
              <TechnicianMessageDialog 
                clientId={client.id}
                technicianId={dashboardData.assignedTechnician.id}
                technicianName={dashboardData.assignedTechnician.name}
              />
            )}
            
            <Button asChild variant="outline" className="h-16 text-left flex-col items-start p-4">
              <Link to="/client/profile">
                <div className="flex items-center space-x-2 mb-1">
                  <Calendar className="h-5 w-5" />
                  <span className="font-semibold">Manage Profile</span>
                </div>
                <span className="text-sm opacity-80">Update your contact information and pool details</span>
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-16 text-left flex-col items-start p-4">
              <Link to="/contact">
                <div className="flex items-center space-x-2 mb-1">
                  <Phone className="h-5 w-5" />
                  <span className="font-semibold">Contact Support</span>
                </div>
                <span className="text-sm opacity-80">Get help with your pool service needs</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}