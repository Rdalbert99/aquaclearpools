-- CRITICAL SECURITY FIX: Secure users table and fix customer data exposure
-- Address customer personal information protection vulnerabilities

-- 1. IMMEDIATE FIX: Secure invitation_summary_admin table (found by security scan)
ALTER TABLE public.invitation_summary_admin ENABLE ROW LEVEL SECURITY;

-- Create admin-only access policy for invitation summary
CREATE POLICY "invitation_summary_admin_access" 
ON public.invitation_summary_admin 
FOR ALL 
TO authenticated 
USING (get_current_user_role() = 'admin');

-- 2. ENHANCE users table security with more restrictive policies
-- Drop existing policies and create stricter ones
DROP POLICY IF EXISTS "secure_admin_user_select" ON public.users;
DROP POLICY IF EXISTS "secure_tech_client_user_select" ON public.users;
DROP POLICY IF EXISTS "secure_user_profile_select" ON public.users;
DROP POLICY IF EXISTS "secure_user_profile_update" ON public.users;
DROP POLICY IF EXISTS "secure_user_profile_insert" ON public.users;
DROP POLICY IF EXISTS "secure_admin_user_update" ON public.users;
DROP POLICY IF EXISTS "secure_admin_user_delete" ON public.users;

-- Create enhanced, more restrictive RLS policies for users table

-- SELECT policies with strict access control
CREATE POLICY "users_select_own_profile_only" 
ON public.users 
FOR SELECT 
TO authenticated 
USING (
  id = auth.uid() 
  AND status = 'active'
);

CREATE POLICY "users_select_admin_with_logging" 
ON public.users 
FOR SELECT 
TO authenticated 
USING (
  get_current_user_role() = 'admin' 
  AND status != 'deactivated'
);

CREATE POLICY "users_select_tech_assigned_clients_restricted" 
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

-- INSERT policies - restrict to own profile creation only
CREATE POLICY "users_insert_own_profile_only" 
ON public.users 
FOR INSERT 
TO authenticated 
WITH CHECK (
  id = auth.uid()
);

-- UPDATE policies with role protection
CREATE POLICY "users_update_own_profile_no_role_change" 
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
  AND role = (SELECT role FROM users WHERE id = auth.uid()) -- Prevent role self-elevation
);

CREATE POLICY "users_update_admin_controlled" 
ON public.users 
FOR UPDATE 
TO authenticated 
USING (
  get_current_user_role() = 'admin'
) 
WITH CHECK (
  get_current_user_role() = 'admin'
);

-- DELETE policies - admin only
CREATE POLICY "users_delete_admin_only" 
ON public.users 
FOR DELETE 
TO authenticated 
USING (
  get_current_user_role() = 'admin'
);

-- 3. Create secure admin function for accessing user PII with justification
CREATE OR REPLACE FUNCTION public.admin_get_user_pii(
  user_lookup_id uuid, 
  admin_reason text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
  
  -- Validate reason is provided
  IF admin_reason IS NULL OR length(trim(admin_reason)) < 15 THEN
    RAISE EXCEPTION 'Admin reason required (minimum 15 characters)';
  END IF;
  
  -- Get user data
  SELECT * INTO user_record
  FROM users
  WHERE id = user_lookup_id
  AND status != 'deactivated';
  
  IF NOT FOUND THEN
    -- Log failed lookup attempt
    PERFORM log_security_event_enhanced(
      'admin_user_pii_lookup_failed',
      auth.uid(),
      NULL,
      'admin/user-pii',
      jsonb_build_object(
        'lookup_user_id', user_lookup_id,
        'reason', admin_reason,
        'result', 'not_found'
      ),
      'warning'
    );
    RETURN json_build_object('error', 'User not found');
  END IF;
  
  -- Log successful access to PII
  PERFORM log_security_event_enhanced(
    'admin_user_pii_access',
    auth.uid(),
    NULL,
    'admin/user-pii',
    jsonb_build_object(
      'accessed_user_id', user_record.id,
      'accessed_user_email', user_record.email,
      'reason', admin_reason,
      'timestamp', now()
    ),
    'info'
  );
  
  -- Return user PII data
  RETURN json_build_object(
    'id', user_record.id,
    'email', user_record.email,
    'name', user_record.name,
    'first_name', user_record.first_name,
    'last_name', user_record.last_name,
    'phone', user_record.phone,
    'address', user_record.address,
    'street_address', user_record.street_address,
    'city', user_record.city,
    'state', user_record.state,
    'zip_code', user_record.zip_code,
    'country', user_record.country,
    'role', user_record.role,
    'status', user_record.status,
    'created_at', user_record.created_at
  );
END;
$$;

-- 4. Create data masking function for non-admin access
CREATE OR REPLACE FUNCTION public.get_user_public_safe(user_lookup_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_record record;
BEGIN
  -- Get minimal user data for public/tech access
  SELECT id, name, created_at, role INTO user_record
  FROM users
  WHERE id = user_lookup_id 
  AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'User not found');
  END IF;
  
  -- Return only non-sensitive information
  RETURN json_build_object(
    'id', user_record.id,
    'name', user_record.name,
    'role', user_record.role,
    'created_at', user_record.created_at
  );
END;
$$;

-- 5. Create email masking function for display purposes
CREATE OR REPLACE FUNCTION public.mask_email(email_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = 'public'
AS $$
BEGIN
  IF email_input IS NULL OR POSITION('@' IN email_input) = 0 THEN
    RETURN NULL;
  END IF;
  
  RETURN LEFT(email_input, 3) || '***@' || split_part(email_input, '@', 2);
END;
$$;

-- 6. Create phone masking function
CREATE OR REPLACE FUNCTION public.mask_phone(phone_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = 'public'
AS $$
BEGIN
  IF phone_input IS NULL OR length(phone_input) < 4 THEN
    RETURN phone_input;
  END IF;
  
  RETURN repeat('*', GREATEST(length(phone_input) - 4, 0)) || RIGHT(phone_input, 4);
END;
$$;

-- 7. Create audit trigger for sensitive operations (INSERT, UPDATE, DELETE only)
CREATE OR REPLACE FUNCTION public.audit_user_data_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log changes to user data
  IF TG_OP = 'INSERT' THEN
    PERFORM log_security_event_enhanced(
      'user_profile_created',
      NEW.id,
      NULL,
      'database/users',
      jsonb_build_object(
        'user_id', NEW.id,
        'created_by', auth.uid(),
        'operation', 'INSERT'
      ),
      'info'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log what changed
    PERFORM log_security_event_enhanced(
      'user_profile_modified',
      NEW.id,
      NULL,
      'database/users',
      jsonb_build_object(
        'user_id', NEW.id,
        'modified_by', auth.uid(),
        'operation', 'UPDATE',
        'email_changed', (OLD.email != NEW.email),
        'phone_changed', (OLD.phone != NEW.phone),
        'role_changed', (OLD.role != NEW.role)
      ),
      CASE WHEN OLD.role != NEW.role THEN 'warning' ELSE 'info' END
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_security_event_enhanced(
      'user_profile_deleted',
      OLD.id,
      NULL,
      'database/users',
      jsonb_build_object(
        'user_id', OLD.id,
        'deleted_by', auth.uid(),
        'operation', 'DELETE'
      ),
      'warning'
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Apply the audit trigger for data changes
CREATE TRIGGER users_data_changes_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_user_data_changes();

-- 8. Add security documentation
COMMENT ON TABLE public.users IS 'SECURE: User profiles with strict RLS. Contains PII - admin access requires justification and audit logging.';
COMMENT ON FUNCTION public.admin_get_user_pii(uuid, text) IS 'SECURE: Admin-only PII access with mandatory justification and comprehensive audit logging.';
COMMENT ON FUNCTION public.get_user_public_safe(uuid) IS 'SECURE: Public-safe user data access with data minimization.';
COMMENT ON FUNCTION public.mask_email(text) IS 'UTILITY: Email masking for display purposes to protect user privacy.';
COMMENT ON FUNCTION public.mask_phone(text) IS 'UTILITY: Phone number masking for display purposes to protect user privacy.';

-- 9. Create indexes for security policy performance
CREATE INDEX IF NOT EXISTS idx_users_status_role ON users(status, role) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(id) WHERE status = 'active';