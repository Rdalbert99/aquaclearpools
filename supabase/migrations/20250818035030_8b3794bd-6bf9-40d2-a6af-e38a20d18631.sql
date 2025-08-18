-- SECURITY FIX: Remove public access to customer reviews to prevent data harvesting
-- This prevents unauthorized access to customer names and review content

-- Drop the existing public access policy for reviews
DROP POLICY IF EXISTS "Everyone can view approved reviews" ON public.reviews;

-- Keep existing secure policies:
-- 1. "Clients can view their own reviews" - allows clients to see reviews they wrote
-- 2. "Admins and techs can view all reviews" - allows staff to manage reviews  
-- 3. "Clients can create their own reviews" - allows review submission
-- 4. "Admins can update review status" - allows review approval/rejection

-- The public will no longer have direct access to customer reviews
-- If public review display is needed for marketing, it should be done through
-- a dedicated edge function with explicit customer consent tracking