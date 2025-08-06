import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Star, Clock, User, Phone, Mail, MapPin, Calendar } from 'lucide-react';

interface ServiceRequest {
  id: string;
  request_type: string;
  status: string;
  priority: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
  description: string;
  requested_date: string;
  created_at: string;
  assigned_technician_id?: string;
  users?: {
    name: string;
    email: string;
  };
}

interface Review {
  id: string;
  customer_name: string;
  review_text: string;
  rating: number;
  status: string;
  created_at: string;
  clients?: {
    customer: string;
  };
}

interface Technician {
  id: string;
  name: string;
  email: string;
}

export const ApprovalCenter = () => {
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load pending service requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('service_requests')
        .select(`
          *,
          users:assigned_technician_id (name, email)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      // Load pending reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select(`
          *,
          clients (customer)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;

      // Load technicians
      const { data: techData, error: techError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('role', ['admin', 'tech']);

      if (techError) throw techError;

      setServiceRequests(requestsData || []);
      setReviews(reviewsData || []);
      setTechnicians(techData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load approval data",
        variant: "destructive",
      });
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

      if (error) throw error;

      toast({
        title: "Success",
        description: "Technician assigned successfully",
      });

      loadData();
    } catch (error) {
      console.error('Error assigning technician:', error);
      toast({
        title: "Error",
        description: "Failed to assign technician",
        variant: "destructive",
      });
    } finally {
      setAssigning(null);
    }
  };

  const updateReviewStatus = async (reviewId: string, status: 'approved' | 'rejected') => {
    setActionLoading(reviewId);
    try {
      const { error } = await supabase
        .from('reviews')
        .update({
          status,
          approved_at: status === 'approved' ? new Date().toISOString() : null,
        })
        .eq('id', reviewId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Review ${status} successfully`,
      });

      loadData();
    } catch (error) {
      console.error('Error updating review:', error);
      toast({
        title: "Error",
        description: `Failed to ${status} review`,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`h-4 w-4 ${
          index < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">For Approval</h1>
        <p className="text-muted-foreground">Manage pending service requests and customer reviews</p>
      </div>

      <Tabs defaultValue="service-requests" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="service-requests">
            Service Requests ({serviceRequests.length})
          </TabsTrigger>
          <TabsTrigger value="reviews">
            Customer Reviews ({reviews.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="service-requests" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Service Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {serviceRequests.map((request) => (
                  <div key={request.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <Badge variant="outline">{request.request_type}</Badge>
                      <Badge variant={getPriorityColor(request.priority)}>{request.priority}</Badge>
                      <Badge variant="secondary">{request.status}</Badge>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{request.contact_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{request.contact_email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{request.contact_phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{request.contact_address}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            Requested: {new Date(request.requested_date).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            Created: {new Date(request.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">Description:</p>
                        <p className="text-sm text-muted-foreground">{request.description}</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t">
                      <div>
                        {request.users ? (
                          <div className="text-sm">
                            <span className="font-medium">Assigned to: </span>
                            <span>{request.users.name} ({request.users.email})</span>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Unassigned</p>
                        )}
                      </div>

                      <div>
                        {request.status === 'pending' && (
                          <Select
                            onValueChange={(techId) => assignTechnician(request.id, techId)}
                            disabled={assigning === request.id}
                          >
                            <SelectTrigger className="w-full sm:w-48">
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
                {serviceRequests.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No pending service requests</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Customer Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {reviews.map((review) => (
                  <div key={review.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{review.customer_name}</span>
                        </div>
                        {review.clients && (
                          <Badge variant="outline">{review.clients.customer}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex space-x-1">
                          {renderStars(review.rating)}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {review.rating}/5
                        </span>
                      </div>
                    </div>

                    <blockquote className="text-sm leading-relaxed p-4 bg-muted rounded-lg">
                      "{review.review_text}"
                    </blockquote>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => updateReviewStatus(review.id, 'approved')}
                          disabled={actionLoading === review.id}
                          size="sm"
                        >
                          {actionLoading === review.id ? <LoadingSpinner /> : 'Approve'}
                        </Button>
                        <Button
                          onClick={() => updateReviewStatus(review.id, 'rejected')}
                          disabled={actionLoading === review.id}
                          variant="outline"
                          size="sm"
                        >
                          {actionLoading === review.id ? <LoadingSpinner /> : 'Reject'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {reviews.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No pending reviews</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};