-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow login lookup for authentication" ON public.users;

-- Create a more secure policy that only allows email lookup by login for authentication
-- This will be used with a security definer function to be safer
CREATE OR REPLACE FUNCTION public.get_email_by_login(login_input text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.users WHERE login = login_input LIMIT 1;
$$;