import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, Check, X, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Review {
  id: string;
  customer_name: string;
  review_text: string;
  rating: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  clients?: {
    customer: string;
  };
}

export default function ReviewManagement() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id,
          customer_name,
          review_text,
          rating,
          status,
          created_at,
          clients (
            customer
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading reviews:', error);
        toast({
          title: "Error loading reviews",
          description: "Failed to load reviews from database.",
          variant: "destructive",
        });
      } else {
        setReviews((data || []) as Review[]);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateReviewStatus = async (reviewId: string, status: 'approved' | 'rejected') => {
    setActionLoading(reviewId);
    
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ 
          status,
          approved_at: status === 'approved' ? new Date().toISOString() : null
        })
        .eq('id', reviewId);

      if (error) {
        throw error;
      }

      // Update local state
      setReviews(reviews.map(review => 
        review.id === reviewId 
          ? { ...review, status }
          : review
      ));

      toast({
        title: `Review ${status}`,
        description: `The review has been ${status} successfully.`,
      });
    } catch (error) {
      console.error('Error updating review status:', error);
      toast({
        title: "Error updating review",
        description: "Failed to update review status.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
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

  const renderReviewCard = (review: Review) => (
    <Card key={review.id} className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <CardTitle className="text-lg">{review.customer_name}</CardTitle>
              <CardDescription>
                Client: {review.clients?.customer || 'Unknown'}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                {renderStars(review.rating)}
              </div>
              <span className="text-sm text-muted-foreground">
                {review.rating}/5
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge 
              variant={
                review.status === 'approved' ? 'default' :
                review.status === 'rejected' ? 'destructive' : 'secondary'
              }
            >
              {review.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(review.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <blockquote className="text-sm leading-relaxed mb-4 p-4 bg-muted/50 rounded-lg">
          "{review.review_text}"
        </blockquote>
        
        {review.status === 'pending' && (
          <div className="flex space-x-2">
            <Button
              size="sm"
              onClick={() => updateReviewStatus(review.id, 'approved')}
              disabled={actionLoading === review.id}
              className="flex items-center space-x-1"
            >
              <Check className="h-4 w-4" />
              <span>Approve</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateReviewStatus(review.id, 'rejected')}
              disabled={actionLoading === review.id}
              className="flex items-center space-x-1"
            >
              <X className="h-4 w-4" />
              <span>Reject</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  const pendingReviews = reviews.filter(r => r.status === 'pending');
  const approvedReviews = reviews.filter(r => r.status === 'approved');
  const rejectedReviews = reviews.filter(r => r.status === 'rejected');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Review Management</h1>
          <p className="text-muted-foreground">
            Manage customer reviews and testimonials
          </p>
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Pending ({pendingReviews.length})</span>
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center space-x-2">
            <Check className="h-4 w-4" />
            <span>Approved ({approvedReviews.length})</span>
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center space-x-2">
            <X className="h-4 w-4" />
            <span>Rejected ({rejectedReviews.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pendingReviews.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Pending Reviews</h3>
                <p className="text-muted-foreground">
                  All reviews have been processed.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingReviews.map(renderReviewCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approved">
          {approvedReviews.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Check className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Approved Reviews</h3>
                <p className="text-muted-foreground">
                  No reviews have been approved yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {approvedReviews.map(renderReviewCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected">
          {rejectedReviews.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <X className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Rejected Reviews</h3>
                <p className="text-muted-foreground">
                  No reviews have been rejected.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {rejectedReviews.map(renderReviewCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}