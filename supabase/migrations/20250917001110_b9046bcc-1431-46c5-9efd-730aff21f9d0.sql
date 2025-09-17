-- CRITICAL SECURITY FIX: Add Explicit Anonymous Access Blocking for Clients Table (Simple Approach)
-- Issue: Ensure explicit blocking of anonymous access to sensitive client business information

-- 1. ADD EXPLICIT BLOCKING POLICIES FOR ANONYMOUS USERS
-- These policies explicitly deny all access to anonymous users

CREATE POLICY "clients_deny_anonymous_select" 
ON public.clients 
FOR SELECT 
TO anon 
USING (false);

CREATE POLICY "clients_deny_anonymous_insert" 
ON public.clients 
FOR INSERT 
TO anon 
WITH CHECK (false);

CREATE POLICY "clients_deny_anonymous_update" 
ON public.clients 
FOR UPDATE 
TO anon 
USING (false)
WITH CHECK (false);

CREATE POLICY "clients_deny_anonymous_delete" 
ON public.clients 
FOR DELETE 
TO anon 
USING (false);

-- 2. CREATE VALIDATION FUNCTION FOR ANONYMOUS PROTECTION
CREATE OR REPLACE FUNCTION validate_clients_anonymous_protection()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  policy_count integer;
  anon_policy_count integer;
BEGIN
  -- Only admins can run validation
  IF get_current_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can validate anonymous protection';
  END IF;
  
  -- Count policies targeting anonymous users
  SELECT COUNT(*) INTO anon_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
    AND tablename = 'clients'
    AND roles::text LIKE '%anon%';
  
  -- Verify sufficient protection
  IF anon_policy_count < 4 THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: Insufficient anonymous blocking policies';
  END IF;
  
  -- Log validation
  PERFORM log_security_event_enhanced(
    'clients_anonymous_protection_validated',
    auth.uid(),
    NULL,
    'security/validation',
    jsonb_build_object(
      'anonymous_blocking_policies', anon_policy_count,
      'validation_passed', true,
      'timestamp', now()
    ),
    'info'
  );
  
  RETURN true;
END;
$$;

-- 3. FINAL SECURITY VALIDATION AND LOGGING
DO $$
BEGIN
  -- Verify RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename = 'clients' 
      AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'CRITICAL: RLS must be enabled on clients table';
  END IF;
  
  -- Log security enhancement completion
  PERFORM log_security_event_enhanced(
    'clients_explicit_anonymous_blocking_complete',
    auth.uid(),
    NULL,
    'security/hardening',
    jsonb_build_object(
      'timestamp', now(),
      'table', 'clients',
      'security_enhancement', 'explicit_anonymous_access_denial',
      'protection_layers', jsonb_build_array(
        'rls_enabled',
        'authenticated_only_policies',
        'explicit_anonymous_blocking',
        'comprehensive_audit_logging',
        'admin_validation_functions'
      )
    ),
    'info'
  );
END;
$$;

-- Update table security documentation
COMMENT ON TABLE public.clients IS 
'MAXIMUM SECURITY: Client business data with multi-layered protection: RLS enabled, authenticated-only access policies, explicit anonymous user blocking, comprehensive audit logging, and admin validation functions. Protects sensitive customer information, contact details, service rates, and business relationships from unauthorized access.';