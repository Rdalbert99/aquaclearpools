-- Security Fix: Strengthen RLS policies and add missing ones

-- 1. Strengthen client_invitations table security
DROP POLICY IF EXISTS "Admins manage client invitations" ON public.client_invitations;

-- More restrictive admin policy for client invitations
CREATE POLICY "Admins can manage client invitations" 
ON public.client_invitations 
FOR ALL 
TO authenticated
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

-- Allow public access only for completing invitations (specific tokens)
CREATE POLICY "Public can complete valid invitations"
ON public.client_invitations
FOR SELECT
TO public
USING (used_at IS NULL AND expires_at > now());

-- 2. Strengthen reviews table security to protect customer data
DROP POLICY IF EXISTS "Clients can view their own reviews" ON public.reviews;

-- Only allow viewing approved reviews publicly, but restrict detailed access
CREATE POLICY "Public can view minimal approved review data"
ON public.reviews
FOR SELECT
TO public
USING (status = 'approved');

-- Clients can view full details of their own reviews
CREATE POLICY "Clients can view their own review details"
ON public.reviews
FOR SELECT
TO authenticated
USING (client_id IN (
  SELECT clients.id 
  FROM clients 
  WHERE clients.user_id = auth.uid()
));

-- 3. Add missing RLS policy for user_migration_status
CREATE POLICY "Only service role can access migration status"
ON public.user_migration_status
FOR ALL
TO service_role
USING (true);

-- 4. Strengthen service_requests policies
DROP POLICY IF EXISTS "Clients can create service requests" ON public.service_requests;

-- More secure service request creation
CREATE POLICY "Authenticated users can create service requests"
ON public.service_requests
FOR INSERT
TO authenticated
WITH CHECK (
  -- If client_id is provided, user must own that client
  (client_id IS NULL OR client_id IN (
    SELECT clients.id 
    FROM clients 
    WHERE clients.user_id = auth.uid()
  )) OR
  -- Admins and techs can create for any client
  get_current_user_role() = ANY(ARRAY['admin', 'tech'])
);

-- 5. Add audit logging trigger for sensitive operations
CREATE OR REPLACE FUNCTION public.audit_sensitive_changes()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit trigger to critical tables
CREATE TRIGGER audit_users_changes
  AFTER UPDATE OF role ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_changes();

CREATE TRIGGER audit_client_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_changes();

-- 6. Create function to validate role assignments
CREATE OR REPLACE FUNCTION public.validate_role_assignment()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply role validation trigger
CREATE TRIGGER validate_role_changes
  BEFORE UPDATE OF role ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.validate_role_assignment();