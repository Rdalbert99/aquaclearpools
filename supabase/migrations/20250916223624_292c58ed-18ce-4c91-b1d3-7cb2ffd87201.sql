-- Create a secure function to get user login data
CREATE OR REPLACE FUNCTION public.get_user_login_data(login_input text)
RETURNS TABLE(role text, name text, login text, must_change_password boolean, user_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT u.role::text, u.name::text, u.login::text, u.must_change_password, u.id
  FROM public.users u
  WHERE lower(u.login) = lower(login_input)
  LIMIT 1;
$$;