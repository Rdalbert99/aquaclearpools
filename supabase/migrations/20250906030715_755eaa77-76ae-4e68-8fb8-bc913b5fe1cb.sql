-- Fix audit function to only log when there's an authenticated user
CREATE OR REPLACE FUNCTION public.audit_sensitive_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Only log if there's an authenticated user
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO user_logins (user_id, login_time, ip_address, user_agent)
    VALUES (
      auth.uid(),
      now(),
      COALESCE(current_setting('request.headers', true)::json->>'x-real-ip', 'unknown'),
      COALESCE(current_setting('request.headers', true)::json->>'user-agent', 'unknown')
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Set all clients as due (but not overdue): last_service_date 8 days ago
UPDATE public.clients
SET last_service_date = (now() - interval '8 days'),
    updated_at = now();