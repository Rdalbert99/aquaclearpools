
-- =====================================================
-- Fix 1: Tighten INSERT policies that use WITH CHECK (true)
-- These currently allow anonymous users to insert into logging tables.
-- SECURITY DEFINER functions bypass RLS, so they don't need permissive policies.
-- We restrict to authenticated users only.
-- =====================================================

-- invitation_access_log: INSERT
DROP POLICY IF EXISTS "System and functions can insert audit logs" ON public.invitation_access_log;
CREATE POLICY "Authenticated system inserts to access log"
  ON public.invitation_access_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- password_reset_attempts: INSERT
DROP POLICY IF EXISTS "Anyone can insert password reset attempts" ON public.password_reset_attempts;
CREATE POLICY "Authenticated inserts to password reset attempts"
  ON public.password_reset_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- security_audit_log: INSERT
DROP POLICY IF EXISTS "System and functions can insert audit logs" ON public.security_audit_log;
CREATE POLICY "Authenticated system inserts to audit log"
  ON public.security_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- user_logins: INSERT
DROP POLICY IF EXISTS "System can insert login records" ON public.user_logins;
CREATE POLICY "Authenticated system inserts to login records"
  ON public.user_logins
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- user_migration_status: Fix the overly permissive ALL policy
DROP POLICY IF EXISTS "Only service role can access migration status" ON public.user_migration_status;
CREATE POLICY "Service role migration access"
  ON public.user_migration_status
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Fix 2: Add search_path to remaining functions
-- =====================================================

-- hash_invitation_token needs pgcrypto extension reference
CREATE OR REPLACE FUNCTION public.hash_invitation_token(token_input text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE STRICT
  SET search_path TO 'public', 'extensions'
AS $function$
  SELECT encode(extensions.digest('invitation_salt_2024_' || token_input, 'sha256'), 'hex');
$function$;

-- mask_phone
CREATE OR REPLACE FUNCTION public.mask_phone(phone_input text)
  RETURNS text
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO 'public'
AS $function$
BEGIN
  IF phone_input IS NULL OR length(phone_input) < 4 THEN
    RETURN NULL;
  END IF;
  RETURN repeat('*', GREATEST(length(phone_input) - 4, 0)) || RIGHT(phone_input, 4);
END;
$function$;

-- update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
