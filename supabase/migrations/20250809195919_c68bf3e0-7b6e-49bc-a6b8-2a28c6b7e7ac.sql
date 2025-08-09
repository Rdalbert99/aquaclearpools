-- Improve role resolution to avoid lockouts when profile id != auth.uid()
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.users 
  WHERE id = auth.uid()
     OR email = COALESCE((current_setting('request.jwt.claims', true)::json ->> 'email'), '')
  LIMIT 1;
$$;