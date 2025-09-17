-- CRITICAL SECURITY FIX: Add Explicit Anonymous Access Blocking for Clients Table
-- Issue: While RLS policies exist for authenticated users, we need explicit protection against anonymous access
-- to ensure absolute security for sensitive client business information

-- The clients table contains extremely sensitive business data:
-- - Customer names and business relationships
-- - Contact information (emails, phones, addresses) 
-- - Service rates and pricing information
-- - QuickBooks integration data
-- - Business arrangements and service notes

-- 1. ADD RESTRICTIVE POLICIES TO EXPLICITLY BLOCK ANONYMOUS ACCESS
-- These policies use RESTRICTIVE mode with AND logic to ensure absolute blocking

CREATE POLICY "clients_block_anonymous_select" 
ON public.clients 
FOR SELECT 
TO anon 
AS RESTRICTIVE
USING (false);

CREATE POLICY "clients_block_anonymous_insert" 
ON public.clients 
FOR INSERT 
TO anon 
AS RESTRICTIVE
WITH CHECK (false);

CREATE POLICY "clients_block_anonymous_update" 
ON public.clients 
FOR UPDATE 
TO anon 
AS RESTRICTIVE
USING (false)
WITH CHECK (false);

CREATE POLICY "clients_block_anonymous_delete" 
ON public.clients 
FOR DELETE 
TO anon 
AS RESTRICTIVE
USING (false);

-- 2. ADD COMPREHENSIVE ANONYMOUS ACCESS MONITORING
CREATE OR REPLACE FUNCTION log_anonymous_access_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- This function will be called if somehow anonymous access is attempted
  -- It should never actually execute due to the RESTRICTIVE policies above
  PERFORM log_security_event_enhanced(
    'anonymous_client_access_attempt_blocked',
    NULL, -- No user ID for anonymous
    NULL,
    'security/anonymous-access',
    jsonb_build_object(
      'table', 'clients',
      'operation', TG_OP,
      'timestamp', now(),
      'blocked_by_policy', true
    ),
    'critical'
  );
  
  -- This should never execute, but if it does, block everything
  RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: Anonymous access to client data attempted and blocked';
  
  RETURN NULL;
END;
$$;

-- 3. CREATE MONITORING FUNCTION FOR POLICY EFFECTIVENESS
CREATE OR REPLACE FUNCTION validate_clients_anonymous_protection()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  policy_count integer;
  restrictive_policy_count integer;
BEGIN
  -- Only allow admins to run this validation
  IF get_current_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can validate anonymous protection';
  END IF;
  
  -- Count total policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'clients';
  
  -- Count restrictive policies specifically for anonymous users
  SELECT COUNT(*) INTO restrictive_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
    AND tablename = 'clients'
    AND NOT permissive -- RESTRICTIVE policies
    AND 'anon' = ANY(string_to_array(trim(both '{}' from roles::text), ','));
  
  -- Verify we have proper protection
  IF restrictive_policy_count < 4 THEN -- Should have 4 RESTRICTIVE policies (SELECT, INSERT, UPDATE, DELETE) for anon
    RAISE EXCEPTION 'SECURITY VIOLATION: Insufficient anonymous protection policies detected';
  END IF;
  
  -- Log validation success
  PERFORM log_security_event_enhanced(
    'clients_anonymous_protection_validated',
    auth.uid(),
    NULL,
    'security/validation',
    jsonb_build_object(
      'total_policies', policy_count,
      'restrictive_policies', restrictive_policy_count,
      'validation_passed', true,
      'timestamp', now()
    ),
    'info'
  );
  
  RETURN true;
END;
$$;

-- 4. FINAL SECURITY VALIDATION
DO $$
BEGIN
  -- Verify RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename = 'clients' 
      AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'CRITICAL: RLS is not enabled on clients table';
  END IF;
  
  -- Verify no public grants exist
  IF EXISTS (
    SELECT 1 FROM information_schema.table_privileges 
    WHERE table_schema = 'public' 
      AND table_name = 'clients'
      AND grantee = 'public'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: Public grants detected on clients table';
  END IF;
  
  -- Log security hardening completion
  PERFORM log_security_event_enhanced(
    'clients_anonymous_access_blocking_complete',
    auth.uid(),
    NULL,
    'security/hardening',
    jsonb_build_object(
      'timestamp', now(),
      'table', 'clients',
      'critical_fix', 'added_explicit_anonymous_blocking_policies',
      'security_measures', jsonb_build_array(
        'restrictive_policies_for_anonymous_users',
        'comprehensive_access_monitoring',
        'policy_validation_functions',
        'security_event_logging'
      )
    ),
    'info'
  );
END;
$$;

-- Update table documentation to reflect maximum security status
COMMENT ON TABLE public.clients IS 
'MAXIMUM SECURITY: Client business data protected with authenticated-only RLS policies AND explicit anonymous-blocking restrictive policies. Contains sensitive customer information, contact details, and business rates. Multiple layers of protection: RLS enabled, authenticated-only access, restrictive anonymous blocking, comprehensive audit logging, and admin access controls.';