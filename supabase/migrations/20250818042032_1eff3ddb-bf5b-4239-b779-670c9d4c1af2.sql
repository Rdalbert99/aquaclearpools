-- Fix function search path security issues

-- Fix audit_sensitive_changes function
CREATE OR REPLACE FUNCTION public.audit_sensitive_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_logins (user_id, login_time, ip_address, user_agent)
  VALUES (
    auth.uid(),
    now(),
    COALESCE(current_setting('request.headers')::json->>'x-real-ip', 'unknown'),
    COALESCE(current_setting('request.headers')::json->>'user-agent', 'unknown')
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fix validate_role_assignment function
CREATE OR REPLACE FUNCTION public.validate_role_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can assign admin or tech roles
  IF NEW.role IN ('admin', 'tech') AND get_current_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can assign admin or tech roles';
  END IF;
  
  -- Prevent self-role elevation for non-admins
  IF NEW.id = auth.uid() AND OLD.role != NEW.role AND get_current_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Users cannot change their own role';
  END IF;
  
  RETURN NEW;
END;
$$;