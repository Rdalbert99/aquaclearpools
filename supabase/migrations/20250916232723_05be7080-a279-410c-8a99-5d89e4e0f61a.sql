-- SECURITY ENHANCEMENT: Secure all database functions with proper search paths
-- This prevents schema injection attacks by ensuring functions only access the public schema

-- Update functions that don't have explicit search_path restrictions
CREATE OR REPLACE FUNCTION public.get_all_technicians()
 RETURNS TABLE(id uuid, name text, email text, login text, phone text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  select u.id, u.name, u.email, u.login, u.phone, u.created_at
  from public.users u
  where u.role = 'tech' and public.get_current_user_role() = 'admin';
$function$;

CREATE OR REPLACE FUNCTION public.get_email_by_login(login_input text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT email 
  FROM public.users 
  WHERE lower(login) = lower(login_input)
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_login_data(login_input text)
 RETURNS TABLE(role text, name text, login text, must_change_password boolean, user_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT u.role::text, u.name::text, u.login::text, u.must_change_password, u.id
  FROM public.users u
  WHERE lower(u.login) = lower(login_input)
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT role FROM public.users 
  WHERE id = auth.uid()
  LIMIT 1;
$function$;

-- Enhanced security monitoring function
CREATE OR REPLACE FUNCTION public.log_security_event_enhanced(
  p_event_type text, 
  p_user_id uuid DEFAULT NULL::uuid, 
  p_session_id text DEFAULT NULL::text, 
  p_endpoint text DEFAULT NULL::text, 
  p_payload jsonb DEFAULT NULL::jsonb, 
  p_severity text DEFAULT 'info'::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_ip inet;
  v_user_agent text;
BEGIN
  -- Extract request metadata safely
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

  INSERT INTO public.security_events (
    event_type,
    user_id,
    session_id,
    ip_address,
    user_agent,
    endpoint,
    payload,
    severity,
    created_at
  ) VALUES (
    p_event_type,
    p_user_id,
    p_session_id,
    v_ip,
    v_user_agent,
    p_endpoint,
    p_payload,
    p_severity,
    now()
  );
END;
$function$;

-- Enhanced rate limiting with better security
CREATE OR REPLACE FUNCTION public.check_rate_limit_enhanced(
  p_identifier text, 
  p_endpoint text, 
  p_max_requests integer DEFAULT 10, 
  p_window_minutes integer DEFAULT 15,
  p_log_violations boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_count integer;
  v_window_start timestamp with time zone;
  v_allowed boolean;
BEGIN
  v_window_start := now() - (p_window_minutes || ' minutes')::interval;
  
  -- Clean up old entries first
  DELETE FROM public.api_rate_limits 
  WHERE window_start < v_window_start;
  
  -- Check current rate
  SELECT COALESCE(SUM(request_count), 0) INTO v_count
  FROM public.api_rate_limits
  WHERE identifier = p_identifier 
    AND endpoint = p_endpoint
    AND window_start >= v_window_start;
  
  v_allowed := v_count < p_max_requests;
  
  -- If under limit, increment counter
  IF v_allowed THEN
    INSERT INTO public.api_rate_limits (identifier, endpoint, request_count, window_start)
    VALUES (p_identifier, p_endpoint, 1, now())
    ON CONFLICT (identifier, endpoint) 
    DO UPDATE SET 
      request_count = api_rate_limits.request_count + 1,
      window_start = CASE 
        WHEN api_rate_limits.window_start < v_window_start THEN now()
        ELSE api_rate_limits.window_start
      END;
  ELSE
    -- Log rate limit violation if enabled
    IF p_log_violations THEN
      PERFORM log_security_event_enhanced(
        'rate_limit_exceeded',
        auth.uid(),
        NULL,
        p_endpoint,
        jsonb_build_object(
          'identifier', p_identifier,
          'current_count', v_count,
          'limit', p_max_requests,
          'window_minutes', p_window_minutes
        ),
        'warning'
      );
    END IF;
  END IF;
  
  RETURN v_allowed;
END;
$function$;

-- Security health check function for monitoring
CREATE OR REPLACE FUNCTION public.security_health_check()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_result json;
  v_failed_logins integer;
  v_rate_limit_violations integer;
  v_recent_events integer;
BEGIN
  -- Only allow admins to run health checks
  IF get_current_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Access denied: Only administrators can run security health checks';
  END IF;
  
  -- Count recent security events
  SELECT COUNT(*) INTO v_failed_logins
  FROM security_events
  WHERE event_type = 'login_failed' 
    AND created_at > now() - interval '1 hour';
    
  SELECT COUNT(*) INTO v_rate_limit_violations
  FROM security_events
  WHERE event_type = 'rate_limit_exceeded'
    AND created_at > now() - interval '1 hour';
    
  SELECT COUNT(*) INTO v_recent_events
  FROM security_events
  WHERE created_at > now() - interval '1 hour';
  
  -- Build health report
  v_result := json_build_object(
    'status', CASE 
      WHEN v_failed_logins > 10 OR v_rate_limit_violations > 50 THEN 'critical'
      WHEN v_failed_logins > 5 OR v_rate_limit_violations > 20 THEN 'warning'
      ELSE 'healthy'
    END,
    'timestamp', now(),
    'metrics', json_build_object(
      'failed_logins_last_hour', v_failed_logins,
      'rate_limit_violations_last_hour', v_rate_limit_violations,
      'total_security_events_last_hour', v_recent_events
    )
  );
  
  -- Log the health check
  PERFORM log_security_event_enhanced(
    'security_health_check',
    auth.uid(),
    NULL,
    'system/health',
    v_result::jsonb,
    'info'
  );
  
  RETURN v_result;
END;
$function$;

-- Add comments for security documentation
COMMENT ON FUNCTION public.check_rate_limit_enhanced(text, text, integer, integer, boolean) IS 'Enhanced rate limiting with security logging and violation tracking';
COMMENT ON FUNCTION public.security_health_check() IS 'Security monitoring health check - admin only access with comprehensive logging';
COMMENT ON FUNCTION public.log_security_event_enhanced(text, uuid, text, text, jsonb, text) IS 'Enhanced security event logging with safe error handling';