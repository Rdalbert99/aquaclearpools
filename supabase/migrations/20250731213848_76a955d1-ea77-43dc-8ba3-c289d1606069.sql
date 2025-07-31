-- Create reviews table for customer testimonials
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  review_text TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Create policies for reviews
CREATE POLICY "Clients can create their own reviews" 
ON public.reviews 
FOR INSERT 
WITH CHECK (client_id IN (
  SELECT id FROM public.clients WHERE user_id = auth.uid()
));

CREATE POLICY "Clients can view their own reviews" 
ON public.reviews 
FOR SELECT 
USING (client_id IN (
  SELECT id FROM public.clients WHERE user_id = auth.uid()
) OR status = 'approved');

CREATE POLICY "Everyone can view approved reviews" 
ON public.reviews 
FOR SELECT 
USING (status = 'approved');

CREATE POLICY "Admins and techs can view all reviews" 
ON public.reviews 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() AND role IN ('admin', 'tech')
));

CREATE POLICY "Admins can update review status" 
ON public.reviews 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() AND role = 'admin'
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();