import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Calendar, 
  MapPin, 
  Phone, 
  Mail, 
  Droplets,
  User,
  ArrowLeft,
  UserPlus,
  CheckCircle,
  FileText
} from 'lucide-react';

interface ServiceRequest {
  id: string;
  request_type: string;
  description: string;
  priority: string;
  status: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_address?: string;
  pool_type?: string;
  pool_size?: string;
  preferred_date?: string;
  requested_date: string;
  client_id?: string;
  clients?: {
    customer: string;
  };
}

export default function ServiceRequestDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (id) {
      loadServiceRequest();
    }
  }, [id]);

  const loadServiceRequest = async () => {
    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select(`
          *,
          clients(customer)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error loading service request:', error);
        toast({
          title: "Error",
          description: "Could not load service request details.",
          variant: "destructive",
        });
        return;
      }

      setRequest(data);
      // Initialize notes with any existing notes
      setNotes(data.description || '');
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCustomer = async () => {
    if (!request || !request.contact_name) return;

    try {
      // Create a new user account
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          name: request.contact_name,
          email: request.contact_email || '',
          phone: request.contact_phone || '',
          address: request.contact_address || '',
          role: 'client',
          login: `${request.contact_name?.toLowerCase().replace(/\s+/g, '') || 'client'}${Date.now()}`, // Generate unique login
          must_change_password: true,
        })
        .select()
        .single();

      if (userError) {
        console.error('Error creating user:', userError);
        toast({
          title: "Error",
          description: "Could not create user account.",
          variant: "destructive",
        });
        return;
      }

      // Create a client record
      const { error: clientError } = await supabase
        .from('clients')
        .insert({
          user_id: newUser.id,
          customer: request.contact_name,
          pool_type: request.pool_type || 'Unknown',
          pool_size: request.pool_size === 'not-sure' ? 15000 : parseInt(request.pool_size?.split('-')[0] || '15000'),
          status: 'Active',
        });

      if (clientError) {
        console.error('Error creating client:', clientError);
        toast({
          title: "Error",
          description: "Could not create client record.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Customer Created",
        description: "New customer account has been created successfully.",
      });

      // Refresh the request to show the linked client
      loadServiceRequest();
    } catch (error) {
      console.error('Error creating customer:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const updateServiceRequest = async (newStatus: string) => {
    if (!request) return;

    setIsUpdating(true);
    try {
      const updateData: any = {
        status: newStatus,
        description: notes,
      };

      // If completing, add completion date and assign to current user
      if (newStatus === 'completed') {
        updateData.completed_date = new Date().toISOString();
        updateData.assigned_technician_id = user?.id;
      }

      const { error } = await supabase
        .from('service_requests')
        .update(updateData)
        .eq('id', request.id);

      if (error) {
        console.error('Error updating service request:', error);
        toast({
          title: "Error",
          description: "Could not update service request.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: `Service request ${newStatus === 'completed' ? 'completed' : 'updated'} successfully.`,
      });

      // Reload the request to show updated data
      loadServiceRequest();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
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

  if (!request) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Service Request Not Found</h1>
          <p className="text-muted-foreground mb-4">The requested service request could not be found.</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Service Request Details</h1>
            <p className="text-muted-foreground">Request ID: {request.id}</p>
          </div>
        </div>
        
        {!request.client_id && request.contact_name && (
          <Button onClick={createCustomer} disabled={isUpdating}>
            <UserPlus className="h-4 w-4 mr-2" />
            Create Customer Account
          </Button>
        )}

        {/* Action buttons for techs/admins */}
        <div className="flex space-x-2">
          {request.status === 'pending' && (
            <Button 
              onClick={() => updateServiceRequest('in-progress')}
              disabled={isUpdating}
              variant="outline"
            >
              Start Work
            </Button>
          )}
          
          {(request.status === 'pending' || request.status === 'in-progress') && (
            <Button 
              onClick={() => updateServiceRequest('completed')}
              disabled={isUpdating}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Complete Work Order
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Contact Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <p className="text-lg font-medium">
                {request.contact_name || request.clients?.customer || 'Unknown'}
              </p>
            </div>
            
            {request.contact_email && (
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${request.contact_email}`} className="text-primary hover:underline">
                  {request.contact_email}
                </a>
              </div>
            )}
            
            {request.contact_phone && (
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${request.contact_phone}`} className="text-primary hover:underline">
                  {request.contact_phone}
                </a>
              </div>
            )}
            
            {request.contact_address && (
              <div className="flex items-start space-x-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(request.contact_address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {request.contact_address}
                </a>
              </div>
            )}
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
            {request.pool_type && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Pool Type</label>
                <p className="text-lg">{request.pool_type}</p>
              </div>
            )}
            
            {request.pool_size && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Pool Size</label>
                <p className="text-lg">{request.pool_size}</p>
              </div>
            )}
            
            {request.preferred_date && (
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground block">Preferred Date</label>
                  <p>{new Date(request.preferred_date).toLocaleDateString()}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Service Request Details */}
      <Card>
        <CardHeader>
          <CardTitle>Service Request Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Service Type</label>
              <p className="text-lg font-medium">{request.request_type}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Priority</label>
              <Badge variant={request.priority === 'high' || request.priority === 'emergency' ? 'destructive' : 'secondary'}>
                {request.priority}
              </Badge>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <Badge variant={request.status === 'completed' ? 'default' : 'secondary'}>
                {request.status}
              </Badge>
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-muted-foreground">Requested Date</label>
            <p>{new Date(request.requested_date).toLocaleString()}</p>
          </div>
          
          <div>
            <label className="text-sm font-medium text-muted-foreground">Description / Service Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2 min-h-[120px]"
              placeholder="Add notes about the service request or work performed..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Work Order Actions */}
      {(user?.role === 'tech' || user?.role === 'admin') && request.status !== 'completed' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Work Order Actions</span>
            </CardTitle>
            <CardDescription>Update the status of this service request</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-4">
              {request.status === 'pending' && (
                <Button 
                  onClick={() => updateServiceRequest('in-progress')}
                  disabled={isUpdating}
                  variant="outline"
                >
                  Start Work
                </Button>
              )}
              
              <Button 
                onClick={() => updateServiceRequest('completed')}
                disabled={isUpdating}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {isUpdating ? 'Completing...' : 'Complete Work Order'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}