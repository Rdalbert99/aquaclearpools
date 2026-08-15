-- Allow authenticated actors' audit rows (table has FORCE RLS, so definer functions are still checked)
GRANT INSERT ON public.security_audit_log TO authenticated;
DROP POLICY IF EXISTS "Authenticated actors can write audit rows" ON public.security_audit_log;
CREATE POLICY "Authenticated actors can write audit rows"
ON public.security_audit_log FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());

GRANT INSERT ON public.security_events TO authenticated;
GRANT INSERT ON public.user_logins TO authenticated;

-- Make logging non-blocking so audit failures never break legitimate updates
CREATE OR REPLACE FUNCTION public.log_security_event(p_event_type text, p_target_user_id uuid DEFAULT NULL, p_target_table text DEFAULT NULL, p_old_values jsonb DEFAULT NULL, p_new_values jsonb DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  BEGIN
    INSERT INTO public.security_audit_log (
      event_type, actor_id, target_user_id, target_table, old_values, new_values, ip_address, user_agent
    ) VALUES (
      p_event_type, auth.uid(), p_target_user_id, p_target_table, p_old_values, p_new_values,
      COALESCE(current_setting('request.headers', true)::json->>'x-real-ip', '0.0.0.0')::inet,
      COALESCE(current_setting('request.headers', true)::json->>'user-agent', 'unknown')
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_security_event_enhanced(p_event_type text, p_user_id uuid DEFAULT NULL, p_session_id text DEFAULT NULL, p_endpoint text DEFAULT NULL, p_payload jsonb DEFAULT NULL, p_severity text DEFAULT 'info')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_ip inet;
  v_user_agent text;
BEGIN
  BEGIN
    v_ip := COALESCE(current_setting('request.headers', true)::json->>'x-real-ip', '0.0.0.0')::inet;
  EXCEPTION WHEN OTHERS THEN
    v_ip := '0.0.0.0'::inet;
  END;
  BEGIN
    v_user_agent := COALESCE(current_setting('request.headers', true)::json->>'user-agent', 'unknown');
  EXCEPTION WHEN OTHERS THEN
    v_user_agent := 'unknown';
  END;

  BEGIN
    INSERT INTO public.security_events (
      event_type, user_id, session_id, ip_address, user_agent, endpoint, payload, severity, created_at
    ) VALUES (
      p_event_type, p_user_id, p_session_id, v_ip, v_user_agent, p_endpoint, p_payload, p_severity, now()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

-- user_logins write from the role-change trigger should also never block the update
CREATE OR REPLACE FUNCTION public.audit_sensitive_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    BEGIN
      INSERT INTO public.user_logins (user_id, login_time, ip_address, user_agent)
      VALUES (
        auth.uid(), now(),
        COALESCE(current_setting('request.headers', true)::json->>'x-real-ip', 'unknown'),
        COALESCE(current_setting('request.headers', true)::json->>'user-agent', 'unknown')
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Null-safe comparisons in the users audit trigger
CREATE OR REPLACE FUNCTION public.audit_user_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    PERFORM public.log_security_event('role_change', NEW.id, 'users',
      jsonb_build_object('role', OLD.role), jsonb_build_object('role', NEW.role));
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.log_security_event('status_change', NEW.id, 'users',
      jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status));
  END IF;
  RETURN NEW;
END;
$$;

-- Role validation must not fire on unrelated field edits
CREATE OR REPLACE FUNCTION public.validate_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  IF NEW.role IN ('admin', 'tech') AND public.get_current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can assign admin or tech roles';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.id = auth.uid() AND public.get_current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Users cannot change their own role';
  END IF;

  RETURN NEW;
END;
$$;