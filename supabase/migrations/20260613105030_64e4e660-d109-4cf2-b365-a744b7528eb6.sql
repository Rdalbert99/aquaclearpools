CREATE OR REPLACE FUNCTION public.get_email_by_login(login_input text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT email
  FROM public.users
  WHERE lower(login) = lower(login_input)
     OR lower(email) = lower(login_input)
  ORDER BY (lower(login) = lower(login_input)) DESC
  LIMIT 1;
$function$;