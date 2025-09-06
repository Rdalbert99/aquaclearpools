-- Fix audit function to be safe outside HTTP context, then set clients due status
CREATE OR REPLACE FUNCTION public.audit_sensitive_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO user_logins (user_id, login_time, ip_address, user_agent)
  VALUES (
    auth.uid(),
    now(),
    COALESCE(current_setting('request.headers', true)::json->>'x-real-ip', 'unknown'),
    COALESCE(current_setting('request.headers', true)::json->>'user-agent', 'unknown')
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Set all clients as due (but not overdue): last_service_date 8 days ago
UPDATE public.clients
SET last_service_date = (now() - interval '8 days'),
    updated_at = now();