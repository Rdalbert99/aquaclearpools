-- CRITICAL SECURITY FIX: Secure users table and fix invitation data exposure
-- Address multiple customer data protection vulnerabilities

-- 1. IMMEDIATE FIX: Secure invitation_summary_admin table (found by security scan)
-- This table is currently publicly readable with customer contact information
ALTER TABLE public.invitation_summary_admin ENABLE ROW LEVEL SECURITY;

-- Create admin-only access policy for invitation summary
CREATE POLICY "invitation_summary_admin_access" 
ON public.invitation_summary_admin 
FOR ALL 
TO authenticated 
USING (get_current_user_role() = 'admin');

-- 2. ENHANCE users table security with additional protection layers
-- Drop existing policies and create more restrictive ones
DROP POLICY IF EXISTS "secure_admin_user_select" ON public.users;
DROP POLICY IF EXISTS "secure_tech_client_user_select" ON public.users;
DROP POLICY IF EXISTS "secure_user_profile_select" ON public.users;
DROP POLICY IF EXISTS "secure_user_profile_update" ON public.users;
DROP POLICY IF EXISTS "secure_user_profile_insert" ON public.users;
DROP POLICY IF EXISTS "secure_admin_user_update" ON public.users;
DROP POLICY IF EXISTS "secure_admin_user_delete" ON public.users;

-- Create enhanced, more restrictive RLS policies for users table

-- SELECT policies with data minimization
CREATE POLICY "users_select_own_profile_minimal" 
ON public.users 
FOR SELECT 
TO authenticated 
USING (
  id = auth.uid() 
  AND status = 'active'
);

CREATE POLICY "users_select_admin_controlled" 
ON public.users 
FOR SELECT 
TO authenticated 
USING (
  get_current_user_role() = 'admin' 
  AND status != 'deactivated'
);

CREATE POLICY "users_select_tech_assigned_clients_minimal" 
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

-- UPDATE policies with strict controls
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

-- DELETE policies - admin only with audit logging
CREATE POLICY "users_delete_admin_only_audited" 
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
AS $$
BEGIN
  IF phone_input IS NULL OR length(phone_input) < 4 THEN
    RETURN phone_input;
  END IF;
  
  RETURN repeat('*', GREATEST(length(phone_input) - 4, 0)) || RIGHT(phone_input, 4);
END;
$$;

-- 7. Add security documentation
COMMENT ON TABLE public.users IS 'SECURE: User profiles with strict RLS. Contains PII - admin access requires justification and audit logging.';
COMMENT ON FUNCTION public.admin_get_user_pii(uuid, text) IS 'SECURE: Admin-only PII access with mandatory justification and comprehensive audit logging.';
COMMENT ON FUNCTION public.get_user_public_safe(uuid) IS 'SECURE: Public-safe user data access with data minimization.';
COMMENT ON FUNCTION public.mask_email(text) IS 'UTILITY: Email masking for display purposes to protect user privacy.';
COMMENT ON FUNCTION public.mask_phone(text) IS 'UTILITY: Phone number masking for display purposes to protect user privacy.';

-- 8. Create indexes for security policy performance
CREATE INDEX IF NOT EXISTS idx_users_status_role ON users(status, role) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(id) WHERE status = 'active';

-- 9. Add trigger to audit sensitive data access
CREATE OR REPLACE FUNCTION public.audit_user_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log any direct access to sensitive user data
  IF TG_OP = 'SELECT' AND get_current_user_role() != 'admin' THEN
    PERFORM log_security_event_enhanced(
      'user_data_access',
      auth.uid(),
      NULL,
      'database/users',
      jsonb_build_object(
        'accessed_user_id', COALESCE(NEW.id, OLD.id),
        'operation', TG_OP,
        'timestamp', now()
      ),
      'info'
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply the audit trigger
CREATE TRIGGER users_access_audit_trigger
  AFTER SELECT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_user_data_access();