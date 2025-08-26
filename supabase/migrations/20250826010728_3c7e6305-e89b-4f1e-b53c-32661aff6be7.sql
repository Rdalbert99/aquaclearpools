-- Remove the overly permissive public RLS policy for reviews
DROP POLICY IF EXISTS "Public can view minimal approved review data" ON public.reviews;

-- Create a more restrictive policy that only allows access through edge functions
CREATE POLICY "Approved reviews accessible via edge functions only" 
ON public.reviews 
FOR SELECT 
USING (false); -- This blocks direct public access, forcing use of edge functions

-- Update the existing edge function policy to be more specific
-- The get-approved-reviews edge function will handle sanitized public access