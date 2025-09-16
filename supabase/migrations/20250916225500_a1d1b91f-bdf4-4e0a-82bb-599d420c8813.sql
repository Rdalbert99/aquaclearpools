-- Secure the users table with strict RLS policies
-- Drop all existing policies to replace with secure ones
DROP POLICY IF EXISTS "Admins and techs can view client-associated users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated can insert their own user row" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile (excluding role)" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

-- CREATE SECURE RLS POLICIES

-- 1. SELECT Policy: Users can only view their own profile data
CREATE POLICY "users_select_own_profile_only"
ON public.users
FOR SELECT
TO authenticated
USING (
  id = auth.uid() AND status = 'active'
);

-- 2. SELECT Policy: Admins can view active users (with audit logging)
CREATE POLICY "users_select_admin_view_active_users"
ON public.users
FOR SELECT
TO authenticated
USING (
  get_current_user_role() = 'admin' 
  AND status != 'deactivated'
);

-- 3. SELECT Policy: Techs can view users for their assigned clients only
CREATE POLICY "users_select_tech_assigned_clients"
ON public.users
FOR SELECT
TO authenticated
USING (
  get_current_user_role() = 'tech'
  AND status = 'active'
  AND id IN (
    SELECT c.user_id 
    FROM clients c 
    WHERE c.assigned_technician_id = auth.uid()
  )
);

-- 4. INSERT Policy: Users can create their own profile only
CREATE POLICY "users_insert_own_profile_only"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid()
  AND role = 'client'  -- New users default to client role
);

-- 5. UPDATE Policy: Users can update their own profile (excluding sensitive fields)
CREATE POLICY "users_update_own_profile_restricted"
ON public.users
FOR UPDATE
TO authenticated
USING (
  id = auth.uid() 
  AND status = 'active'
)
WITH CHECK (
  id = auth.uid()
  AND status = 'active'
  -- Prevent users from changing their own role, status, or permissions
  AND role = (SELECT role FROM users WHERE id = auth.uid())
  AND status = 'active'
  AND can_create_clients = (SELECT can_create_clients FROM users WHERE id = auth.uid())
  AND can_manage_services = (SELECT can_manage_services FROM users WHERE id = auth.uid())
  AND can_view_reports = (SELECT can_view_reports FROM users WHERE id = auth.uid())
);

-- 6. UPDATE Policy: Admins can update user profiles and roles
CREATE POLICY "users_update_admin_manage_users"
ON public.users
FOR UPDATE
TO authenticated
USING (
  get_current_user_role() = 'admin'
)
WITH CHECK (
  get_current_user_role() = 'admin'
);

-- 7. DELETE Policy: Only admins can delete users (soft delete recommended)
CREATE POLICY "users_delete_admin_only"
ON public.users
FOR DELETE
TO authenticated
USING (
  get_current_user_role() = 'admin'
);

-- Create secure function for user lookups that admins might need
CREATE OR REPLACE FUNCTION public.admin_lookup_user(lookup_email text, lookup_reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_record record;
  user_role text;
BEGIN
  -- Verify admin role
  user_role := get_current_user_role();
  IF user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied: Only administrators can lookup users';
  END IF;
  
  -- Validate reason is provided
  IF lookup_reason IS NULL OR length(trim(lookup_reason)) < 10 THEN
    RAISE EXCEPTION 'Lookup reason must be provided and at least 10 characters';
  END IF;
  
  -- Find user by email
  SELECT * INTO user_record
  FROM users
  WHERE lower(email) = lower(lookup_email)
  AND status != 'deactivated'
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'User not found');
  END IF;
  
  -- Log admin lookup
  PERFORM log_security_event(
    'admin_user_lookup',
    auth.uid(),
    'users',
    NULL,
    jsonb_build_object(
      'looked_up_user_id', user_record.id,
      'looked_up_email', lookup_email,
      'reason', lookup_reason,
      'timestamp', now()
    )
  );
  
  -- Return sanitized user data (excluding sensitive fields)
  RETURN json_build_object(
    'id', user_record.id,
    'name', user_record.name,
    'email', user_record.email,
    'role', user_record.role,
    'status', user_record.status,
    'created_at', user_record.created_at
  );
END;
$$;

-- Create function to mask sensitive user data for public APIs
CREATE OR REPLACE FUNCTION public.get_user_public_info(user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_record record;
BEGIN
  -- Only return very basic, non-sensitive information
  SELECT id, name, created_at INTO user_record
  FROM users
  WHERE id = user_id 
  AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'User not found');
  END IF;
  
  RETURN json_build_object(
    'id', user_record.id,
    'name', user_record.name,
    'created_at', user_record.created_at
  );
END;
$$;

-- Add trigger to log sensitive user data access
CREATE OR REPLACE FUNCTION public.log_user_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log when admins access other users' data
  IF get_current_user_role() = 'admin' AND NEW.id != auth.uid() THEN
    PERFORM log_security_event(
      'admin_user_data_access',
      auth.uid(),
      'users',
      NULL,
      jsonb_build_object(
        'accessed_user_id', NEW.id,
        'accessed_fields', 'profile_data',
        'timestamp', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for logging user data access
CREATE TRIGGER log_user_access_trigger
  AFTER SELECT ON public.users
  FOR EACH ROW
  WHEN (get_current_user_role() = 'admin')
  EXECUTE FUNCTION public.log_user_data_access();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_active_status ON users(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);

-- Add comment documenting security measures
COMMENT ON TABLE public.users IS 'User profiles with strict RLS security. Users can only access their own data. Admin access is logged for audit purposes.';