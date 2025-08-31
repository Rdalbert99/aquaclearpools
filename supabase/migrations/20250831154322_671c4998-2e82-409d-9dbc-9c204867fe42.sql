-- CRITICAL SECURITY FIX: Remove insecure email fallback from get_current_user_role()
-- This prevents privilege escalation through email spoofing
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.users 
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Add user status field for proper deactivation instead of role demotion
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add check constraint for valid status values
ALTER TABLE public.users 
ADD CONSTRAINT valid_user_status 
CHECK (status IN ('active', 'suspended', 'deactivated'));

-- Create audit log table for security events
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  actor_id uuid REFERENCES auth.users(id),
  target_user_id uuid,
  target_table text,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" 
ON public.security_audit_log 
FOR SELECT 
USING (get_current_user_role() = 'admin');

-- System can insert audit logs
CREATE POLICY "System can insert audit logs" 
ON public.security_audit_log 
FOR INSERT 
WITH CHECK (true);

-- Create function to log security events
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

-- Update users table policies to check status
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users" 
ON public.users 
FOR SELECT 
USING (get_current_user_role() = 'admin' AND status != 'deactivated');

-- Prevent deactivated users from accessing their profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" 
ON public.users 
FOR SELECT 
USING (auth.uid() = id AND status = 'active');

-- Create trigger to log role changes
CREATE OR REPLACE FUNCTION public.audit_user_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

CREATE TRIGGER audit_user_changes_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_user_changes();