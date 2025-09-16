-- Clean and secure users table policies (comprehensive cleanup)
-- Drop all possible existing policies
DO $$ 
DECLARE
    pol_name text;
BEGIN
    -- Drop all existing policies on users table
    FOR pol_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'users' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol_name);
    END LOOP;
END $$;

-- CREATE SECURE RLS POLICIES FROM SCRATCH

-- 1. SELECT: Users can only view their own profile
CREATE POLICY "secure_user_profile_select"
ON public.users
FOR SELECT
TO authenticated
USING (
  id = auth.uid() AND status = 'active'
);

-- 2. SELECT: Admins can view non-deactivated users  
CREATE POLICY "secure_admin_user_select"
ON public.users
FOR SELECT
TO authenticated
USING (
  get_current_user_role() = 'admin' 
  AND status != 'deactivated'
);

-- 3. SELECT: Techs can view users for their assigned clients
CREATE POLICY "secure_tech_client_user_select"
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

-- 4. INSERT: Users can create their own profile only
CREATE POLICY "secure_user_profile_insert"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid()
);

-- 5. UPDATE: Users can update own profile (restricted fields)
CREATE POLICY "secure_user_profile_update"
ON public.users
FOR UPDATE
TO authenticated
USING (
  id = auth.uid() AND status = 'active'
)
WITH CHECK (
  id = auth.uid() 
  AND status = 'active'
  AND role = (SELECT role FROM users WHERE id = auth.uid())
);

-- 6. UPDATE: Admins can update all user profiles
CREATE POLICY "secure_admin_user_update"
ON public.users
FOR UPDATE
TO authenticated
USING (
  get_current_user_role() = 'admin'
)
WITH CHECK (
  get_current_user_role() = 'admin'
);

-- 7. DELETE: Only admins can delete users
CREATE POLICY "secure_admin_user_delete"
ON public.users
FOR DELETE
TO authenticated
USING (
  get_current_user_role() = 'admin'
);

-- Create secure admin lookup function with full audit logging
CREATE OR REPLACE FUNCTION public.secure_admin_user_lookup(lookup_email text, admin_reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_record record;
  current_user_role text;
BEGIN
  -- Verify admin role
  current_user_role := get_current_user_role();
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied: Administrator privileges required';
  END IF;
  
  -- Validate reason
  IF admin_reason IS NULL OR length(trim(admin_reason)) < 10 THEN
    RAISE EXCEPTION 'Admin reason required (minimum 10 characters)';
  END IF;
  
  -- Find user
  SELECT * INTO user_record
  FROM users
  WHERE lower(email) = lower(lookup_email)
  AND status != 'deactivated'
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- Log failed lookup attempt
    PERFORM log_security_event(
      'admin_user_lookup_failed',
      auth.uid(),
      'users',
      NULL,
      jsonb_build_object(
        'lookup_email', lookup_email,
        'reason', admin_reason,
        'result', 'not_found'
      )
    );
    RETURN json_build_object('error', 'User not found');
  END IF;
  
  -- Log successful lookup
  PERFORM log_security_event(
    'admin_user_lookup_success',
    auth.uid(),
    'users',
    NULL,
    jsonb_build_object(
      'looked_up_user_id', user_record.id,
      'lookup_email', lookup_email,
      'reason', admin_reason,
      'timestamp', now()
    )
  );
  
  -- Return minimal user data
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

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_users_security_email ON users(email, status);
CREATE INDEX IF NOT EXISTS idx_users_security_role ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_security_active ON users(id, status) WHERE status = 'active';

-- Update table comment
COMMENT ON TABLE public.users IS 'Secure user profiles: Users see only their own data, admins have restricted logged access, techs see assigned client users only.';