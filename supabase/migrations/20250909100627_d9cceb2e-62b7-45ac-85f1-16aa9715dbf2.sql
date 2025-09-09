-- Security hardening migration (retry with corrected policy creation)

-- 1) Ensure RLS is enabled and admin-only access for invitation security summary
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invitation_security_summary'
  ) THEN
    EXECUTE 'ALTER TABLE public.invitation_security_summary ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Admins only can view invitation security summaries" ON public.invitation_security_summary';
    EXECUTE 'CREATE POLICY "Admins only can view invitation security summaries" ON public.invitation_security_summary FOR SELECT USING (public.get_current_user_role() = ''admin'')';
  END IF;
END $$;

-- 2) Add updated_at and audit/validation triggers
-- Users table: role validation, updated_at, audit
DROP TRIGGER IF EXISTS users_validate_role_assignment ON public.users;
CREATE TRIGGER users_validate_role_assignment
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.validate_role_assignment();

DROP TRIGGER IF EXISTS users_update_updated_at ON public.users;
CREATE TRIGGER users_update_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS users_audit_changes ON public.users;
CREATE TRIGGER users_audit_changes
  AFTER UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_changes();

-- Generic updated_at triggers for commonly edited tables
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS clients_update_updated_at ON public.clients';
    EXECUTE 'CREATE TRIGGER clients_update_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='services' AND column_name='updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS services_update_updated_at ON public.services';
    EXECUTE 'CREATE TRIGGER services_update_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name='updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS reviews_update_updated_at ON public.reviews';
    EXECUTE 'CREATE TRIGGER reviews_update_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='service_requests' AND column_name='updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS service_requests_update_updated_at ON public.service_requests';
    EXECUTE 'CREATE TRIGGER service_requests_update_updated_at BEFORE UPDATE ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='client_users' AND column_name='updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS client_users_update_updated_at ON public.client_users';
    EXECUTE 'CREATE TRIGGER client_users_update_updated_at BEFORE UPDATE ON public.client_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
END $$;

-- 3) Password reset rate-limiting table and policies
CREATE TABLE IF NOT EXISTS public.password_reset_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_hash text NOT NULL,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.password_reset_attempts ENABLE ROW LEVEL SECURITY;

-- Admins can view attempts
DROP POLICY IF EXISTS "Admins can view password reset attempts" ON public.password_reset_attempts;
CREATE POLICY "Admins can view password reset attempts"
  ON public.password_reset_attempts
  FOR SELECT
  USING (public.get_current_user_role() = 'admin');

-- Allow system/clients to insert logs (no auth requirement)
DROP POLICY IF EXISTS "Anyone can insert password reset attempts" ON public.password_reset_attempts;
CREATE POLICY "Anyone can insert password reset attempts"
  ON public.password_reset_attempts
  FOR INSERT
  WITH CHECK (true);

-- Indexes for rate limiting
CREATE INDEX IF NOT EXISTS idx_password_reset_attempts_identifier_time ON public.password_reset_attempts (identifier_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_attempts_ip_time ON public.password_reset_attempts (ip, created_at DESC);

-- 4) Function to allow/deny reset attempts with logging
CREATE OR REPLACE FUNCTION public.allow_password_reset_request(p_identifier text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip text;
  v_ua text;
  v_identifier_hash text;
  v_cnt_ip int;
  v_cnt_id int;
  v_allowed boolean;
  v_window interval := interval '15 minutes';
  v_max_attempts int := 5;
BEGIN
  v_ip := COALESCE(current_setting('request.headers', true)::json->>'x-real-ip', 'unknown');
  v_ua := COALESCE(current_setting('request.headers', true)::json->>'user-agent', 'unknown');
  v_identifier_hash := md5(lower(coalesce(p_identifier, '')));

  SELECT count(*) INTO v_cnt_ip
  FROM public.password_reset_attempts
  WHERE ip = v_ip AND created_at > now() - v_window;

  SELECT count(*) INTO v_cnt_id
  FROM public.password_reset_attempts
  WHERE identifier_hash = v_identifier_hash AND created_at > now() - v_window;

  v_allowed := (COALESCE(v_cnt_ip,0) < v_max_attempts) AND (COALESCE(v_cnt_id,0) < v_max_attempts);

  -- Always log the attempt
  INSERT INTO public.password_reset_attempts(identifier_hash, ip, user_agent)
  VALUES (v_identifier_hash, v_ip, v_ua);

  -- Audit log
  PERFORM public.log_security_event(
    'password_reset_request',
    NULL,
    NULL,
    NULL,
    jsonb_build_object('identifier_hash', v_identifier_hash, 'ip', v_ip, 'allowed', v_allowed)
  );

  RETURN v_allowed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.allow_password_reset_request(text) TO anon, authenticated;
