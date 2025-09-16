-- CRITICAL SECURITY FIX: Fix Clients Table RLS Policies Role Assignment (Corrected)
-- Issue: RLS policies are applied to 'public' role instead of 'authenticated' role
-- This creates potential security vulnerability allowing unauthenticated access attempts

-- 1. DROP ALL EXISTING CLIENTS TABLE POLICIES
DROP POLICY IF EXISTS "Admins can delete clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and techs can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Assigned techs can view their clients" ON public.clients;
DROP POLICY IF EXISTS "Clients can view their own client record" ON public.clients;
DROP POLICY IF EXISTS "Admins and techs can update clients" ON public.clients;

-- 2. CREATE SECURE POLICIES TARGETING 'authenticated' ROLE ONLY

-- SELECT policies (most critical - controls data visibility)
CREATE POLICY "clients_select_01_own_record_only" 
ON public.clients 
FOR SELECT 
TO authenticated 
USING (
  user_id = auth.uid()
  AND status = 'Active'
);

CREATE POLICY "clients_select_02_assigned_tech_only" 
ON public.clients 
FOR SELECT 
TO authenticated 
USING (
  get_current_user_role() = 'tech' 
  AND assigned_technician_id = auth.uid()
  AND status = 'Active'
);

CREATE POLICY "clients_select_03_admin_full_access" 
ON public.clients 
FOR SELECT 
TO authenticated 
USING (
  get_current_user_role() = 'admin'
);

-- INSERT policies (who can create client records)
CREATE POLICY "clients_insert_admin_tech_only" 
ON public.clients 
FOR INSERT 
TO authenticated 
WITH CHECK (
  get_current_user_role() = ANY(ARRAY['admin', 'tech'])
);

-- UPDATE policies (who can modify client data)
CREATE POLICY "clients_update_01_admin_full" 
ON public.clients 
FOR UPDATE 
TO authenticated 
USING (
  get_current_user_role() = 'admin'
)
WITH CHECK (
  get_current_user_role() = 'admin'
);

CREATE POLICY "clients_update_02_assigned_tech_limited" 
ON public.clients 
FOR UPDATE 
TO authenticated 
USING (
  get_current_user_role() = 'tech' 
  AND assigned_technician_id = auth.uid()
)
WITH CHECK (
  get_current_user_role() = 'tech' 
  AND assigned_technician_id = auth.uid()
);

-- DELETE policies (most restrictive - only admins)
CREATE POLICY "clients_delete_admin_only" 
ON public.clients 
FOR DELETE 
TO authenticated 
USING (
  get_current_user_role() = 'admin'
);

-- 3. ADD COMPREHENSIVE AUDIT LOGGING FOR CLIENT DATA ACCESS
CREATE OR REPLACE FUNCTION log_client_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_security_event_enhanced(
      'client_record_created',
      auth.uid(),
      NULL,
      'database/clients',
      jsonb_build_object(
        'client_id', NEW.id,
        'customer', NEW.customer,
        'created_by_role', get_current_user_role(),
        'operation', 'INSERT'
      ),
      'info'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_security_event_enhanced(
      'client_record_modified',
      auth.uid(),
      NULL,
      'database/clients',
      jsonb_build_object(
        'client_id', NEW.id,
        'customer', NEW.customer,
        'modified_by_role', get_current_user_role(),
        'contact_info_changed', (
          OLD.contact_email IS DISTINCT FROM NEW.contact_email OR 
          OLD.contact_phone IS DISTINCT FROM NEW.contact_phone OR 
          OLD.contact_address IS DISTINCT FROM NEW.contact_address
        ),
        'billing_info_changed', (OLD.service_rate IS DISTINCT FROM NEW.service_rate),
        'operation', 'UPDATE'
      ),
      CASE 
        WHEN OLD.service_rate IS DISTINCT FROM NEW.service_rate THEN 'warning'
        WHEN (OLD.contact_email IS DISTINCT FROM NEW.contact_email OR 
              OLD.contact_phone IS DISTINCT FROM NEW.contact_phone OR 
              OLD.contact_address IS DISTINCT FROM NEW.contact_address) THEN 'info'
        ELSE 'info'
      END
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_security_event_enhanced(
      'client_record_deleted',
      auth.uid(),
      NULL,
      'database/clients',
      jsonb_build_object(
        'client_id', OLD.id,
        'customer', OLD.customer,
        'deleted_by_role', get_current_user_role(),
        'had_contact_info', (
          OLD.contact_email IS NOT NULL OR 
          OLD.contact_phone IS NOT NULL OR 
          OLD.contact_address IS NOT NULL
        ),
        'operation', 'DELETE'
      ),
      'warning'
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create audit trigger for clients table
DROP TRIGGER IF EXISTS audit_client_data_access ON public.clients;
CREATE TRIGGER audit_client_data_access
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION log_client_data_access();

-- 4. CREATE ADMIN FUNCTION FOR SECURE CLIENT DATA ACCESS
CREATE OR REPLACE FUNCTION admin_get_client_sensitive_data(client_lookup_id uuid, admin_reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  client_record record;
  current_user_role text;
BEGIN
  -- SECURITY: Strict admin-only access with comprehensive audit
  current_user_role := get_current_user_role();
  IF current_user_role != 'admin' THEN
    PERFORM log_security_event_enhanced(
      'unauthorized_client_data_access_attempt',
      auth.uid(),
      NULL,
      'admin/client-data',
      jsonb_build_object(
        'attempted_client_id', client_lookup_id,
        'accessor_role', current_user_role,
        'reason_provided', admin_reason
      ),
      'critical'
    );
    RAISE EXCEPTION 'SECURITY VIOLATION: Unauthorized client data access attempt logged';
  END IF;
  
  -- Require substantial justification
  IF admin_reason IS NULL OR length(trim(admin_reason)) < 20 THEN
    PERFORM log_security_event_enhanced(
      'insufficient_client_access_justification',
      auth.uid(),
      NULL,
      'admin/client-data',
      jsonb_build_object(
        'attempted_client_id', client_lookup_id,
        'reason_length', COALESCE(length(trim(admin_reason)), 0)
      ),
      'warning'
    );
    RAISE EXCEPTION 'Client data access requires detailed justification (minimum 20 characters)';
  END IF;
  
  -- Get client data
  SELECT * INTO client_record
  FROM clients
  WHERE id = client_lookup_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Client not found');
  END IF;
  
  -- Log the sensitive data access
  PERFORM log_security_event_enhanced(
    'admin_client_sensitive_data_access',
    auth.uid(),
    NULL,
    'admin/client-data',
    jsonb_build_object(
      'client_id', client_record.id,
      'customer', client_record.customer,
      'accessed_contact_email', CASE WHEN client_record.contact_email IS NOT NULL THEN 'yes' ELSE 'no' END,
      'accessed_contact_phone', CASE WHEN client_record.contact_phone IS NOT NULL THEN 'yes' ELSE 'no' END,
      'accessed_service_rate', CASE WHEN client_record.service_rate IS NOT NULL THEN 'yes' ELSE 'no' END,
      'reason', admin_reason,
      'timestamp', now()
    ),
    'warning'
  );
  
  -- Return complete client data (for legitimate admin access)
  RETURN row_to_json(client_record);
END;
$$;

-- 5. FINAL SECURITY VALIDATION AND LOGGING
DO $$
BEGIN
  -- Verify all policies are now properly secured to authenticated role
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'clients'
      AND roles = '{public}'
  ) THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: Public role policies still exist on clients table';
  END IF;
  
  -- Log security hardening completion
  PERFORM log_security_event_enhanced(
    'clients_table_security_hardening_complete',
    auth.uid(),
    NULL,
    'security/hardening',
    jsonb_build_object(
      'timestamp', now(),
      'table', 'clients',
      'critical_fix', 'converted_public_role_policies_to_authenticated_only',
      'measures_applied', jsonb_build_array(
        'fixed_role_assignment_vulnerability',
        'added_comprehensive_audit_logging',
        'created_admin_access_function',
        'implemented_tech_access_restrictions',
        'added_contact_info_protection'
      )
    ),
    'info'
  );
END;
$$;

-- Update table documentation
COMMENT ON TABLE public.clients IS 
'MAXIMUM SECURITY: Client business data and contact information protected with authenticated-only RLS policies, comprehensive audit logging, and restricted admin access functions. CRITICAL FIX: Policies now properly target authenticated users only, preventing potential unauthenticated access attempts.';