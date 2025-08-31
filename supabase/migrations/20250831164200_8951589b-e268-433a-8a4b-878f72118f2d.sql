-- Harden security_audit_log access: restrict reads to admins, block anon, and tighten function privileges

-- 1) Ensure RLS is enabled (idempotent)
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- 2) Ensure admin-only SELECT policy exists (create if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'security_audit_log' 
      AND policyname = 'Admins can view audit logs'
  ) THEN
    CREATE POLICY "Admins can view audit logs"
    ON public.security_audit_log
    FOR SELECT
    USING (public.get_current_user_role() = 'admin');
  END IF;
END $$;

-- 3) Ensure insert policy exists for system inserts only via SECURITY DEFINER function
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'security_audit_log' 
      AND policyname = 'System can insert audit logs'
  ) THEN
    CREATE POLICY "System can insert audit logs"
    ON public.security_audit_log
    FOR INSERT
    WITH CHECK (true);
  END IF;
END $$;

-- 4) Revoke table privileges from anon and public; keep authenticated readable (RLS still restricts to admins)
REVOKE ALL ON TABLE public.security_audit_log FROM PUBLIC;
REVOKE ALL ON TABLE public.security_audit_log FROM anon;

-- Ensure authenticated retains SELECT to allow admin users (who connect as authenticated) to read via RLS
GRANT SELECT ON TABLE public.security_audit_log TO authenticated;

-- Prevent direct data modification by regular clients; inserts should go through SECURITY DEFINER function
REVOKE INSERT, UPDATE, DELETE ON TABLE public.security_audit_log FROM authenticated;

-- 5) Tighten function execution privileges so unauthenticated/public cannot call it
REVOKE ALL ON FUNCTION public.log_security_event(text, uuid, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_security_event(text, uuid, text, jsonb, jsonb) FROM anon;

-- Allow authenticated app users and service role to execute the logging function
GRANT EXECUTE ON FUNCTION public.log_security_event(text, uuid, text, jsonb, jsonb) TO authenticated, service_role;