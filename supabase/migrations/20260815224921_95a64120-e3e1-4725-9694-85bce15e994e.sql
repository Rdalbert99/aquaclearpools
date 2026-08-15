ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_email text;

UPDATE public.users
SET auth_email = lower(trim(a.email))
FROM auth.users a
WHERE public.users.id = a.id
  AND public.users.auth_email IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_email_unique
  ON public.users (lower(auth_email))
  WHERE auth_email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_email_by_login(login_input text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
  SELECT auth_email
  FROM public.users
  WHERE lower(login) = lower(trim(login_input))
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_email_by_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_login(text) TO anon, authenticated;