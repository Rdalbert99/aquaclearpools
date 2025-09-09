import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Star, StarIcon, Send } from 'lucide-react';
import { toast } from 'sonner';

interface ReviewDialogProps {
  clientId: string;
}

export function ReviewDialog({ clientId }: ReviewDialogProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmitReview = async () => {
    if (!rating || !reviewText.trim() || !user?.name) {
      toast.error('Please provide both a rating and review text');
      return;
    }

    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('reviews')
        .insert({
          client_id: clientId,
          customer_name: user.name,
          rating: rating,
          review_text: reviewText.trim(),
          status: 'pending'
        });

      if (error) throw error;

      toast.success('Review submitted successfully! It will be reviewed before being published.');
      setRating(0);
      setReviewText('');
      setIsOpen(false);
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    } finally {
      setIsLoading(false);
    }
  };

  const StarRating = ({ rating, onRatingChange }: { rating: number; onRatingChange: (rating: number) => void }) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onRatingChange(star)}
            className="focus:outline-none"
          >
            <Star
              className={`h-6 w-6 ${
                star <= rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-16 text-left flex-col items-start p-4">
          <div className="flex items-center space-x-2 mb-1">
            <StarIcon className="h-5 w-5" />
            <span className="font-semibold">Leave a Review</span>
          </div>
          <span className="text-sm opacity-80">Share your experience with our service</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Leave a Review</DialogTitle>
          <DialogDescription>
            Help us improve our service by sharing your experience
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Rating */}
          <div className="space-y-2">
            <Label>Your Rating</Label>
            <StarRating rating={rating} onRatingChange={setRating} />
            <p className="text-sm text-muted-foreground">
              {rating === 0 && 'Select a rating'}
              {rating === 1 && 'Poor'}
              {rating === 2 && 'Fair'}
              {rating === 3 && 'Good'}
              {rating === 4 && 'Very Good'}
              {rating === 5 && 'Excellent'}
            </p>
          </div>

          {/* Review Text */}
          <div className="space-y-2">
            <Label htmlFor="reviewText">Your Review</Label>
            <Textarea
              id="reviewText"
              placeholder="Tell us about your experience with our pool service..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="min-h-[120px]"
            />
          </div>

          {/* Submit Button */}
          <Button 
            onClick={handleSubmitReview} 
            disabled={!rating || !reviewText.trim() || isLoading}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {isLoading ? 'Submitting...' : 'Submit Review'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}