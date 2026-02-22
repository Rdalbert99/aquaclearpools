
-- Fix RLS policies with WITH CHECK (true) on INSERT for audit/logging tables
-- Tighten to require authenticated users only (auth.uid() IS NOT NULL)

-- 1. invitation_access_log
DROP POLICY IF EXISTS "Authenticated system inserts to access log" ON public.invitation_access_log;
CREATE POLICY "Authenticated system inserts to access log" ON public.invitation_access_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 2. password_reset_attempts
DROP POLICY IF EXISTS "Authenticated inserts to password reset attempts" ON public.password_reset_attempts;
CREATE POLICY "Authenticated inserts to password reset attempts" ON public.password_reset_attempts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 3. security_audit_log
DROP POLICY IF EXISTS "Authenticated system inserts to audit log" ON public.security_audit_log;
CREATE POLICY "Authenticated system inserts to audit log" ON public.security_audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 4. security_events
DROP POLICY IF EXISTS "System can insert security events" ON public.security_events;
CREATE POLICY "System can insert security events" ON public.security_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 5. user_logins
DROP POLICY IF EXISTS "Authenticated system inserts to login records" ON public.user_logins;
CREATE POLICY "Authenticated system inserts to login records" ON public.user_logins
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 6. user_migration_status - tighten service role migration access
DROP POLICY IF EXISTS "Service role migration access" ON public.user_migration_status;
CREATE POLICY "Service role migration access" ON public.user_migration_status
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
