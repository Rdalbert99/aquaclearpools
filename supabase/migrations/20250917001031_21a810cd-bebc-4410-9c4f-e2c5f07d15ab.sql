-- CRITICAL SECURITY FIX: Add Explicit Anonymous Access Blocking for Clients Table (Corrected Syntax)
-- Issue: While RLS policies exist for authenticated users, we need explicit protection against anonymous access

-- 1. ADD RESTRICTIVE POLICIES TO EXPLICITLY BLOCK ANONYMOUS ACCESS
-- These policies use RESTRICTIVE mode to ensure absolute blocking of anonymous users

CREATE POLICY "clients_block_anonymous_select" 
ON public.clients 
FOR SELECT 
TO anon 
USING (false)
WITH (restrictive);

CREATE POLICY "clients_block_anonymous_insert" 
ON public.clients 
FOR INSERT 
TO anon 
WITH CHECK (false)
WITH (restrictive);

CREATE POLICY "clients_block_anonymous_update" 
ON public.clients 
FOR UPDATE 
TO anon 
USING (false)
WITH CHECK (false)
WITH (restrictive);

CREATE POLICY "clients_block_anonymous_delete" 
ON public.clients 
FOR DELETE 
TO anon 
USING (false)
WITH (restrictive);

-- 2. CREATE MONITORING FUNCTION FOR POLICY EFFECTIVENESS
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
  -- Only allow admins to run this validation
  IF get_current_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can validate anonymous protection';
  END IF;
  
  -- Count total policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'clients';
  
  -- Count policies for anonymous users
  SELECT COUNT(*) INTO anon_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
    AND tablename = 'clients'
    AND roles::text LIKE '%anon%';
  
  -- Verify we have proper protection
  IF anon_policy_count < 4 THEN -- Should have 4 policies (SELECT, INSERT, UPDATE, DELETE) for anon
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
      'anonymous_policies', anon_policy_count,
      'validation_passed', true,
      'timestamp', now()
    ),
    'info'
  );
  
  RETURN true;
END;
$$;

-- 3. FINAL SECURITY VALIDATION
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
        'explicit_anonymous_user_blocking',
        'policy_validation_functions',
        'security_event_logging'
      )
    ),
    'info'
  );
END;
$$;

-- Update table documentation
COMMENT ON TABLE public.clients IS 
'MAXIMUM SECURITY: Client business data protected with authenticated-only RLS policies AND explicit anonymous-blocking policies. RLS enabled, no public grants, comprehensive audit logging, and admin access controls ensure complete protection of sensitive customer information and business data.';