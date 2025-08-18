-- Make login lookup function bypass RLS and be case-insensitive
CREATE OR REPLACE FUNCTION public.get_email_by_login(login_input text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT email 
  FROM public.users 
  WHERE lower(login) = lower(login_input)
  LIMIT 1;
$function$;

-- Ensure anon/authenticated can execute the function
GRANT EXECUTE ON FUNCTION public.get_email_by_login(text) TO anon, authenticated;