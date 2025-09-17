-- Update database functions to include proper search_path parameter for security hardening

-- Update get_current_user_role function
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE 
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Update get_email_by_login function
CREATE OR REPLACE FUNCTION public.get_email_by_login(login_input text)
RETURNS text
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email 
  FROM public.users 
  WHERE lower(login) = lower(login_input)
  LIMIT 1;
$$;

-- Update get_all_technicians function
CREATE OR REPLACE FUNCTION public.get_all_technicians()
RETURNS TABLE(id uuid, name text, email text, login text, phone text, created_at timestamp with time zone)
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  select u.id, u.name, u.email, u.login, u.phone, u.created_at
  from public.users u
  where u.role = 'tech' and public.get_current_user_role() = 'admin';
$$;

-- Update hash_invitation_token function
CREATE OR REPLACE FUNCTION public.hash_invitation_token(token_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE 
STRICT
SET search_path = public
AS $$
  SELECT encode(digest('invitation_salt_2024_' || token_input, 'sha256'), 'hex');
$$;

-- Update mask_email function  
CREATE OR REPLACE FUNCTION public.mask_email(email_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF email_input IS NULL OR POSITION('@' IN email_input) = 0 THEN
    RETURN NULL;
  END IF;
  
  RETURN LEFT(email_input, 3) || '***@' || split_part(email_input, '@', 2);
END;
$$;