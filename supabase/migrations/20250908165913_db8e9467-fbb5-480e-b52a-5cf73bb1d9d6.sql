-- Fix RLS policies for better security and technician access

-- 1. Ensure invitation_access_log is admin-only access
DROP POLICY IF EXISTS "System can insert audit logs" ON public.invitation_access_log;
DROP POLICY IF EXISTS "Admins can view invitation access logs" ON public.invitation_access_log;

CREATE POLICY "System and functions can insert audit logs" 
ON public.invitation_access_log 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins only can view invitation access logs" 
ON public.invitation_access_log 
FOR SELECT 
USING (get_current_user_role() = 'admin');

-- 2. Ensure client_users table has proper access restrictions
DROP POLICY IF EXISTS "Users can view their own client relationships" ON public.client_users;
DROP POLICY IF EXISTS "Admins and techs can view all client users" ON public.client_users;

CREATE POLICY "Users can view own client relationships only" 
ON public.client_users 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins and assigned techs can view client relationships" 
ON public.client_users 
FOR SELECT 
USING (
  get_current_user_role() = 'admin' OR 
  (get_current_user_role() = 'tech' AND EXISTS (
    SELECT 1 FROM public.clients c 
    WHERE c.id = client_id AND c.assigned_technician_id = auth.uid()
  ))
);

-- 3. Enhance client access for assigned technicians
DROP POLICY IF EXISTS "Assigned techs can view clients" ON public.clients;

CREATE POLICY "Assigned techs can view their clients" 
ON public.clients 
FOR SELECT 
USING (
  assigned_technician_id = auth.uid() OR
  get_current_user_role() = 'admin'
);

-- 4. Ensure security audit log is admin-only
DROP POLICY IF EXISTS "System can insert audit logs" ON public.security_audit_log;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.security_audit_log;

CREATE POLICY "System and functions can insert audit logs" 
ON public.security_audit_log 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins only can view security audit logs" 
ON public.security_audit_log 
FOR SELECT 
USING (get_current_user_role() = 'admin');

-- 5. Add password change audit logging
CREATE OR REPLACE FUNCTION public.log_password_change()
RETURNS trigger AS $$
BEGIN
  -- Log password change events
  PERFORM public.log_security_event(
    'password_change',
    auth.uid(),
    'auth.users',
    NULL,
    jsonb_build_object('timestamp', now())
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;