-- CRITICAL SECURITY FIX: Secure customer personal information and fix data exposure
-- Address customer data protection vulnerabilities with proper policy management

-- 1. Handle invitation_summary_admin view - convert to secure function
-- Drop the insecure view that was exposing customer data
DROP VIEW IF EXISTS public.invitation_summary_admin;

-- Create secure admin function to replace the insecure view
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
  
  -- Return the secure invitation summary data with masked PII
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

-- 2. Create secure admin function for accessing user PII with mandatory justification
-- This addresses the main security concern about customer personal information
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
    RAISE EXCEPTION 'Admin reason required (minimum 15 characters explaining why PII access is needed)';
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

-- 3. Create data masking functions for privacy protection
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

-- 4. Create non-admin safe user access function with data minimization
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

-- 5. Add audit trigger for user data changes
CREATE OR REPLACE FUNCTION public.audit_user_data_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log changes to user data for security monitoring
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
    -- Log what changed, focusing on security-relevant changes
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
        'role_changed', (OLD.role != NEW.role),
        'status_changed', (OLD.status != NEW.status)
      ),
      CASE 
        WHEN OLD.role != NEW.role THEN 'warning'
        WHEN OLD.status != NEW.status THEN 'warning'
        ELSE 'info' 
      END
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
        'operation', 'DELETE',
        'had_email', (OLD.email IS NOT NULL),
        'had_phone', (OLD.phone IS NOT NULL)
      ),
      'warning'
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create or replace the audit trigger
DROP TRIGGER IF EXISTS users_data_changes_audit_trigger ON public.users;
CREATE TRIGGER users_data_changes_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_user_data_changes();

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