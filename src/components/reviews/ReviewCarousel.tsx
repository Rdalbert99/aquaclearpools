import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Review {
  id: string;
  customer_name: string;
  review_text: string;
  rating: number;
  created_at: string;
}

export const ReviewCarousel = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('id, customer_name, review_text, rating, created_at')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          console.error('Error fetching reviews:', error);
        } else {
          setReviews(data || []);
        }
      } catch (error) {
        console.error('Error fetching reviews:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, []);

  if (loading) {
    return (
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mx-auto mb-4"></div>
            <div className="h-4 bg-muted rounded w-96 mx-auto"></div>
          </div>
        </div>
      </section>
    );
  }

  if (reviews.length === 0) {
    return null; // Don't show section if no reviews
  }

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

  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">What Our Customers Say</h2>
          <p className="text-xl text-muted-foreground">
            Real testimonials from satisfied pool owners
          </p>
        </div>

        <div className="flex justify-center">
          <Carousel
            className="w-full max-w-4xl"
            opts={{
              align: "center",
              loop: true,
              skipSnaps: false,
              dragFree: true,
            }}
          >
            <CarouselContent className="-ml-4">
              {reviews.map((review) => (
                <CarouselItem key={review.id} className="pl-4 basis-full md:basis-1/2 lg:basis-1/3">
                  <div className="p-1">
                    <Card className="h-full hover-scale transition-all duration-300 hover:shadow-lg">
                      <CardContent className="p-6 flex flex-col h-full">
                        <div className="flex items-center mb-4">
                          <div className="flex space-x-1 mr-3">
                            {renderStars(review.rating)}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {review.rating}/5
                          </span>
                        </div>
                        
                        <blockquote className="text-sm leading-relaxed mb-4 flex-grow">
                          "{review.review_text}"
                        </blockquote>
                        
                        <div className="flex items-center justify-between">
                          <cite className="font-semibold not-italic">
                            {review.customer_name}
                          </cite>
                          <span className="text-xs text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden md:flex -left-12 hover:bg-primary hover:text-primary-foreground transition-colors" />
            <CarouselNext className="hidden md:flex -right-12 hover:bg-primary hover:text-primary-foreground transition-colors" />
          </Carousel>
        </div>

        {/* Mobile scroll indicator */}
        <div className="flex justify-center mt-6 md:hidden">
          <p className="text-sm text-muted-foreground">
            Swipe to see more reviews
          </p>
        </div>
      </div>
    </section>
  );
};