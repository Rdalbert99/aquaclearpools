
-- 1. user_migration_status: remove permissive authenticated policy; keep admin-only. service_role bypasses RLS.
DROP POLICY IF EXISTS "Service role migration access" ON public.user_migration_status;

-- 2. invitation_access_log: restrict INSERT to service_role only (edge functions / DB triggers run as definer)
DROP POLICY IF EXISTS "Authenticated system inserts to access log" ON public.invitation_access_log;
CREATE POLICY "Service role inserts to access log"
ON public.invitation_access_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- 3. password_reset_attempts: restrict INSERT to service_role only
DROP POLICY IF EXISTS "Authenticated inserts to password reset attempts" ON public.password_reset_attempts;
CREATE POLICY "Service role inserts to password reset attempts"
ON public.password_reset_attempts
FOR INSERT
TO service_role
WITH CHECK (true);

-- 4. security_audit_log: restrict INSERT to service_role only
DROP POLICY IF EXISTS "Authenticated system inserts to audit log" ON public.security_audit_log;
CREATE POLICY "Service role inserts to audit log"
ON public.security_audit_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- 5. Privilege escalation hardening on users.role
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF public.get_current_user_role() <> 'admin' THEN
      RAISE EXCEPTION 'Only administrators can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_role_self_escalation_trg ON public.users;
CREATE TRIGGER prevent_role_self_escalation_trg
BEFORE UPDATE OF role ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_role_self_escalation();
