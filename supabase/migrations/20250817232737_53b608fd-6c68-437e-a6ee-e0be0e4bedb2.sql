-- Ensure RLS is enabled on the users table (idempotent)
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

-- Harden function that could expose user emails by login
-- Switch to SECURITY INVOKER so RLS applies (users only see their own row; admins see all)
ALTER FUNCTION public.get_email_by_login(login_input text) SECURITY INVOKER;

-- Prevent unauthenticated callers from invoking this RPC
REVOKE EXECUTE ON FUNCTION public.get_email_by_login(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_login(text) TO authenticated;