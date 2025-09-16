-- CRITICAL SECURITY FIX: Secure users table and customer personal information
-- Address customer data protection vulnerabilities

-- 1. Handle invitation_summary_admin view - convert to secure function
-- Drop the insecure view
DROP VIEW IF EXISTS public.invitation_summary_admin;

-- Create secure admin function to replace the view
CREATE OR REPLACE FUNCTION public.admin_get_invitation_summary_secure(admin_reason text)
RETURNS TABLE(
  id uuid,
  client_id uuid,
  customer character varying,
  email_masked text,
  phone_masked text,
  created_at timestamp with time zone,
  expires_at timestamp with time zone,
  used_at timestamp with time zone,
  status text,
  access_count bigint,
  last_accessed timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_role text;
BEGIN
  -- Verify admin role
  user_role := get_current_user_role();
  IF user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied: Only administrators can access invitation summaries';
  END IF;
  
  -- Validate reason is provided
  IF admin_reason IS NULL OR length(trim(admin_reason)) < 15 THEN
    RAISE EXCEPTION 'Admin reason required (minimum 15 characters)';
  END IF;
  
  -- Log admin access to sensitive invitation data
  PERFORM log_security_event_enhanced(
    'admin_invitation_summary_access',
    auth.uid(),
    NULL,
    'admin/invitations',
    jsonb_build_object(
      'reason', admin_reason,
      'timestamp', now(),
      'access_type', 'invitation_summary_view'
    ),
    'info'
  );
  
  -- Return the secure invitation summary data
  RETURN QUERY
  SELECT 
    ci.id,
    ci.client_id,
    c.customer,
    CASE
      WHEN ci.email IS NOT NULL AND POSITION('@' IN ci.email) > 0
      THEN LEFT(ci.email, 3) || '***@' || split_part(ci.email, '@', 2)
      ELSE NULL::text
    END AS email_masked,
    CASE
      WHEN ci.phone IS NOT NULL AND length(ci.phone) > 4
      THEN repeat('*', GREATEST(length(ci.phone) - 4, 0)) || RIGHT(ci.phone, 4)
      WHEN ci.phone IS NOT NULL
      THEN ci.phone
      ELSE NULL::text
    END AS phone_masked,
    ci.created_at,
    ci.expires_at,
    ci.used_at,
    CASE
      WHEN ci.used_at IS NOT NULL THEN 'used'::text
      WHEN ci.expires_at < now() THEN 'expired'::text
      ELSE 'active'::text
    END AS status,
    COUNT(ial.id) AS access_count,
    MAX(ial.accessed_at) AS last_accessed
  FROM client_invitations ci
  LEFT JOIN clients c ON ci.client_id = c.id
  LEFT JOIN invitation_access_log ial ON ci.id = ial.invitation_id
  GROUP BY ci.id, c.customer;
END;
$$;

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

-- SELECT policies - no public access, strict authentication required
CREATE POLICY "users_select_own_profile_only" 
ON public.users 
FOR SELECT 
TO authenticated 
USING (
  id = auth.uid() 
  AND status = 'active'
);

CREATE POLICY "users_select_admin_with_audit" 
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

-- UPDATE policies with role protection
CREATE POLICY "users_update_own_profile_no_privilege_escalation" 
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

-- DELETE policies - admin only with audit
CREATE POLICY "users_delete_admin_only_with_audit" 
ON public.users 
FOR DELETE 
TO authenticated 
USING (
  get_current_user_role() = 'admin'
);

-- 3. Create secure admin function for accessing user PII with mandatory justification
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
  
  -- Validate reason is provided and sufficient
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
  
  -- Log successful access to PII with full audit trail
  PERFORM log_security_event_enhanced(
    'admin_user_pii_access',
    auth.uid(),
    NULL,
    'admin/user-pii',
    jsonb_build_object(
      'accessed_user_id', user_record.id,
      'accessed_user_email', user_record.email,
      'accessed_user_phone', CASE WHEN user_record.phone IS NOT NULL THEN 'present' ELSE 'null' END,
      'reason', admin_reason,
      'timestamp', now(),
      'admin_user_id', auth.uid()
    ),
    'info'
  );
  
  -- Return complete user PII data for legitimate admin access
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
    'created_at', user_record.created_at,
    'updated_at', user_record.updated_at
  );
END;
$$;

-- 4. Create data masking functions for privacy protection
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

-- 5. Create non-admin safe user access function
CREATE OR REPLACE FUNCTION public.get_user_public_safe(user_lookup_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_record record;
BEGIN
  -- Get minimal user data for public/tech access (no PII)
  SELECT id, name, created_at, role INTO user_record
  FROM users
  WHERE id = user_lookup_id 
  AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'User not found');
  END IF;
  
  -- Log access for monitoring
  PERFORM log_security_event_enhanced(
    'user_public_info_access',
    auth.uid(),
    NULL,
    'public/user-info',
    jsonb_build_object(
      'accessed_user_id', user_record.id,
      'accessor_role', get_current_user_role()
    ),
    'info'
  );
  
  -- Return only non-sensitive information
  RETURN json_build_object(
    'id', user_record.id,
    'name', user_record.name,
    'role', user_record.role,
    'created_at', user_record.created_at
  );
END;
$$;

-- 6. Add comprehensive security documentation
COMMENT ON TABLE public.users IS 'SECURE: User profiles with strict RLS. Contains PII - admin access requires justification and full audit logging.';
COMMENT ON FUNCTION public.admin_get_user_pii(uuid, text) IS 'SECURE: Admin-only PII access with mandatory 15+ character justification and comprehensive audit logging.';
COMMENT ON FUNCTION public.get_user_public_safe(uuid) IS 'SECURE: Public-safe user data access with data minimization - only non-PII fields.';
COMMENT ON FUNCTION public.admin_get_invitation_summary_secure(text) IS 'SECURE: Admin-only invitation summary with data masking and audit logging.';
COMMENT ON FUNCTION public.mask_email(text) IS 'UTILITY: Email masking for display purposes to protect user privacy.';
COMMENT ON FUNCTION public.mask_phone(text) IS 'UTILITY: Phone number masking for display purposes to protect user privacy.';

-- 7. Create performance indexes for security policies
CREATE INDEX IF NOT EXISTS idx_users_status_role ON users(status, role) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_users_email_status ON users(email, status) WHERE status = 'active';