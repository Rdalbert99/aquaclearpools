-- Fix case-insensitive role resolution so admins are recognized even if email casing differs
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT role FROM public.users 
  WHERE id = auth.uid()
     OR lower(email) = lower(COALESCE((current_setting('request.jwt.claims', true)::json ->> 'email'), ''))
  ORDER BY created_at DESC
  LIMIT 1;
$function$;