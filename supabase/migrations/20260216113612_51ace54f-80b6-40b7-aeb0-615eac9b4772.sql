-- Fix 1: Remove the blocking reviews policy that uses USING (false)
DROP POLICY IF EXISTS "Approved reviews accessible via edge functions only" ON public.reviews;

-- Fix 2: Fix any remaining SECURITY DEFINER functions without search_path
-- hash_invitation_token is SQL IMMUTABLE (not SECURITY DEFINER) so it's fine
-- get_current_user_role needs checking
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;