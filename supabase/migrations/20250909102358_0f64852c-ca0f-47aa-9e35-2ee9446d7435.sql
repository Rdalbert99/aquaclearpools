-- Fix missing DELETE policies that are critical security gaps
-- Add DELETE policy for chemical_calculations (currently missing)
CREATE POLICY "Admins only can delete chemical calculations" 
ON public.chemical_calculations 
FOR DELETE 
TO authenticated
USING (get_current_user_role() = 'admin');

-- Add DELETE policy for reviews (currently missing)  
CREATE POLICY "Admins only can delete reviews" 
ON public.reviews 
FOR DELETE 
TO authenticated
USING (get_current_user_role() = 'admin');

-- Add email validation constraint to client_invitations
ALTER TABLE public.client_invitations 
ADD CONSTRAINT email_format_check 
CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Add rate limiting table for edge function calls
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier text NOT NULL, -- IP address or user ID
  endpoint text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on rate limits table
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only system functions can access rate limits
CREATE POLICY "System only can manage rate limits" 
ON public.api_rate_limits 
FOR ALL 
TO authenticated
USING (false)
WITH CHECK (false);

-- Create rate limiting function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier text,
  p_endpoint text,
  p_max_requests integer DEFAULT 10,
  p_window_minutes integer DEFAULT 15
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_window_start timestamp with time zone;
BEGIN
  v_window_start := now() - (p_window_minutes || ' minutes')::interval;
  
  -- Clean up old entries
  DELETE FROM public.api_rate_limits 
  WHERE window_start < v_window_start;
  
  -- Check current rate
  SELECT COALESCE(SUM(request_count), 0) INTO v_count
  FROM public.api_rate_limits
  WHERE identifier = p_identifier 
    AND endpoint = p_endpoint
    AND window_start >= v_window_start;
  
  -- If under limit, increment counter
  IF v_count < p_max_requests THEN
    INSERT INTO public.api_rate_limits (identifier, endpoint, request_count, window_start)
    VALUES (p_identifier, p_endpoint, 1, now())
    ON CONFLICT (identifier, endpoint) 
    DO UPDATE SET 
      request_count = api_rate_limits.request_count + 1,
      window_start = CASE 
        WHEN api_rate_limits.window_start < v_window_start THEN now()
        ELSE api_rate_limits.window_start
      END;
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Add unique constraint for rate limiting
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_identifier_endpoint 
ON public.api_rate_limits (identifier, endpoint);

-- Enhanced Security Monitoring
-- Add security events table for better monitoring
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  user_id uuid,
  session_id text,
  ip_address inet,
  user_agent text,
  endpoint text,
  payload jsonb,
  severity text NOT NULL DEFAULT 'info', -- info, warning, critical
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on security events
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view security events
CREATE POLICY "Admins only can view security events" 
ON public.security_events 
FOR SELECT 
TO authenticated
USING (get_current_user_role() = 'admin');

-- System can insert security events
CREATE POLICY "System can insert security events" 
ON public.security_events 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Create function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event_enhanced(
  p_event_type text,
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_endpoint text DEFAULT NULL,
  p_payload jsonb DEFAULT NULL,
  p_severity text DEFAULT 'info'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_events (
    event_type,
    user_id,
    session_id,
    ip_address,
    user_agent,
    endpoint,
    payload,
    severity
  ) VALUES (
    p_event_type,
    p_user_id,
    p_session_id,
    COALESCE(current_setting('request.headers', true)::json->>'x-real-ip', '0.0.0.0')::inet,
    COALESCE(current_setting('request.headers', true)::json->>'user-agent', 'unknown'),
    p_endpoint,
    p_payload,
    p_severity
  );
END;
$$;