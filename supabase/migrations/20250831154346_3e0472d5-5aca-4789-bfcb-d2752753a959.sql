-- Fix function search path security warnings
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_target_user_id uuid DEFAULT NULL,
  p_target_table text DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.security_audit_log (
    event_type,
    actor_id,
    target_user_id,
    target_table,
    old_values,
    new_values,
    ip_address,
    user_agent
  ) VALUES (
    p_event_type,
    auth.uid(),
    p_target_user_id,
    p_target_table,
    p_old_values,
    p_new_values,
    COALESCE(current_setting('request.headers', true)::json->>'x-real-ip', '0.0.0.0')::inet,
    COALESCE(current_setting('request.headers', true)::json->>'user-agent', 'unknown')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_user_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log role changes
  IF OLD.role != NEW.role THEN
    PERFORM public.log_security_event(
      'role_change',
      NEW.id,
      'users',
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role)
    );
  END IF;
  
  -- Log status changes
  IF OLD.status != NEW.status THEN
    PERFORM public.log_security_event(
      'status_change',
      NEW.id,
      'users',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status)
    );
  END IF;
  
  RETURN NEW;
END;
$$;