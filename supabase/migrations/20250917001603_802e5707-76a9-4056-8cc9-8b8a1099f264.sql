-- CRITICAL SECURITY FIX: Fix Services Table RLS Policies Role Assignment
-- Issue: RLS policies are applied to 'public' role instead of 'authenticated' role
-- This creates a critical vulnerability allowing potential unauthorized access to sensitive service data

-- The services table contains extremely sensitive business and customer data:
-- - Service costs and pricing information (valuable to competitors)
-- - Chemical readings and pool chemistry data
-- - Customer service notes and communications
-- - Service methodology and chemicals used
-- - Business operational details

-- 1. DROP ALL EXISTING SERVICES TABLE POLICIES (targeting wrong role)
DROP POLICY IF EXISTS "Admins can delete services" ON public.services;
DROP POLICY IF EXISTS "Techs and admins can insert services" ON public.services;
DROP POLICY IF EXISTS "Users can view related services" ON public.services;
DROP POLICY IF EXISTS "Techs and admins can update services" ON public.services;

-- 2. CREATE SECURE POLICIES TARGETING 'authenticated' ROLE ONLY

-- SELECT policies (most critical - controls data visibility)
CREATE POLICY "services_select_01_client_own_services" 
ON public.services 
FOR SELECT 
TO authenticated 
USING (
  client_id IN (
    SELECT c.id 
    FROM clients c 
    WHERE c.user_id = auth.uid()
  )
);

CREATE POLICY "services_select_02_assigned_tech_only" 
ON public.services 
FOR SELECT 
TO authenticated 
USING (
  get_current_user_role() = 'tech' 
  AND technician_id = auth.uid()
);

CREATE POLICY "services_select_03_admin_full_access" 
ON public.services 
FOR SELECT 
TO authenticated 
USING (
  get_current_user_role() = 'admin'
);

-- INSERT policies (who can create service records)
CREATE POLICY "services_insert_tech_admin_only" 
ON public.services 
FOR INSERT 
TO authenticated 
WITH CHECK (
  get_current_user_role() = ANY(ARRAY['admin', 'tech'])
);

-- UPDATE policies (who can modify service data)
CREATE POLICY "services_update_01_admin_full" 
ON public.services 
FOR UPDATE 
TO authenticated 
USING (
  get_current_user_role() = 'admin'
)
WITH CHECK (
  get_current_user_role() = 'admin'
);

CREATE POLICY "services_update_02_assigned_tech_limited" 
ON public.services 
FOR UPDATE 
TO authenticated 
USING (
  get_current_user_role() = 'tech' 
  AND technician_id = auth.uid()
)
WITH CHECK (
  get_current_user_role() = 'tech' 
  AND technician_id = auth.uid()
);

-- DELETE policies (most restrictive - only admins)
CREATE POLICY "services_delete_admin_only" 
ON public.services 
FOR DELETE 
TO authenticated 
USING (
  get_current_user_role() = 'admin'
);

-- 3. ADD EXPLICIT ANONYMOUS BLOCKING POLICIES
CREATE POLICY "services_deny_anonymous_select" 
ON public.services 
FOR SELECT 
TO anon 
USING (false);

CREATE POLICY "services_deny_anonymous_insert" 
ON public.services 
FOR INSERT 
TO anon 
WITH CHECK (false);

CREATE POLICY "services_deny_anonymous_update" 
ON public.services 
FOR UPDATE 
TO anon 
USING (false)
WITH CHECK (false);

CREATE POLICY "services_deny_anonymous_delete" 
ON public.services 
FOR DELETE 
TO anon 
USING (false);

-- 4. ADD COMPREHENSIVE AUDIT LOGGING FOR SERVICE DATA ACCESS
CREATE OR REPLACE FUNCTION log_service_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_security_event_enhanced(
      'service_record_created',
      auth.uid(),
      NULL,
      'database/services',
      jsonb_build_object(
        'service_id', NEW.id,
        'client_id', NEW.client_id,
        'technician_id', NEW.technician_id,
        'has_cost_data', (NEW.cost IS NOT NULL),
        'has_chemical_data', (NEW.ph_level IS NOT NULL OR NEW.chlorine_level IS NOT NULL),
        'created_by_role', get_current_user_role(),
        'operation', 'INSERT'
      ),
      'info'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_security_event_enhanced(
      'service_record_modified',
      auth.uid(),
      NULL,
      'database/services',
      jsonb_build_object(
        'service_id', NEW.id,
        'client_id', NEW.client_id,
        'cost_changed', (OLD.cost IS DISTINCT FROM NEW.cost),
        'chemical_data_changed', (
          OLD.ph_level IS DISTINCT FROM NEW.ph_level OR 
          OLD.chlorine_level IS DISTINCT FROM NEW.chlorine_level
        ),
        'notes_changed', (OLD.notes IS DISTINCT FROM NEW.notes),
        'modified_by_role', get_current_user_role(),
        'operation', 'UPDATE'
      ),
      CASE 
        WHEN OLD.cost IS DISTINCT FROM NEW.cost THEN 'warning'
        ELSE 'info'
      END
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_security_event_enhanced(
      'service_record_deleted',
      auth.uid(),
      NULL,
      'database/services',
      jsonb_build_object(
        'service_id', OLD.id,
        'client_id', OLD.client_id,
        'had_cost_data', (OLD.cost IS NOT NULL),
        'had_chemical_data', (OLD.ph_level IS NOT NULL OR OLD.chlorine_level IS NOT NULL),
        'deleted_by_role', get_current_user_role(),
        'operation', 'DELETE'
      ),
      'critical'
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create audit trigger for services table
DROP TRIGGER IF EXISTS audit_service_data_access ON public.services;
CREATE TRIGGER audit_service_data_access
  AFTER INSERT OR UPDATE OR DELETE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION log_service_data_access();

-- 5. CREATE ADMIN FUNCTION FOR SECURE SERVICE DATA ACCESS
CREATE OR REPLACE FUNCTION admin_get_service_sensitive_data(service_id uuid, admin_reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  service_record record;
  current_user_role text;
BEGIN
  -- SECURITY: Strict admin-only access with audit
  current_user_role := get_current_user_role();
  IF current_user_role != 'admin' THEN
    PERFORM log_security_event_enhanced(
      'unauthorized_service_data_access_attempt',
      auth.uid(),
      NULL,
      'admin/service-data',
      jsonb_build_object(
        'attempted_service_id', service_id,
        'accessor_role', current_user_role
      ),
      'critical'
    );
    RAISE EXCEPTION 'SECURITY VIOLATION: Unauthorized service data access attempt';
  END IF;
  
  -- Require justification
  IF admin_reason IS NULL OR length(trim(admin_reason)) < 20 THEN
    RAISE EXCEPTION 'Service data access requires detailed justification (minimum 20 characters)';
  END IF;
  
  -- Get service data
  SELECT * INTO service_record FROM services WHERE id = service_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Service record not found');
  END IF;
  
  -- Log the sensitive data access
  PERFORM log_security_event_enhanced(
    'admin_service_sensitive_data_access',
    auth.uid(),
    NULL,
    'admin/service-data',
    jsonb_build_object(
      'service_id', service_record.id,
      'client_id', service_record.client_id,
      'accessed_cost_data', CASE WHEN service_record.cost IS NOT NULL THEN 'yes' ELSE 'no' END,
      'accessed_chemical_data', CASE WHEN service_record.ph_level IS NOT NULL THEN 'yes' ELSE 'no' END,
      'reason', admin_reason
    ),
    'warning'
  );
  
  RETURN row_to_json(service_record);
END;
$$;

-- 6. FINAL SECURITY VALIDATION
DO $$
BEGIN
  -- Verify all policies are now properly secured to authenticated role
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'services'
      AND roles = '{public}'
  ) THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: Public role policies still exist on services table';
  END IF;
  
  -- Log security hardening completion
  PERFORM log_security_event_enhanced(
    'services_table_security_hardening_complete',
    auth.uid(),
    NULL,
    'security/hardening',
    jsonb_build_object(
      'timestamp', now(),
      'table', 'services',
      'critical_fix', 'converted_public_role_policies_to_authenticated_only',
      'measures_applied', jsonb_build_array(
        'fixed_role_assignment_vulnerability',
        'added_explicit_anonymous_blocking',
        'added_comprehensive_audit_logging',
        'created_admin_access_function',
        'implemented_role_based_restrictions'
      )
    ),
    'info'
  );
END;
$$;

-- Update table documentation
COMMENT ON TABLE public.services IS 
'MAXIMUM SECURITY: Service records with sensitive chemical data, costs, and customer notes protected with authenticated-only RLS policies, explicit anonymous blocking, comprehensive audit logging, and admin access controls. CRITICAL FIX: Policies now properly target authenticated users only, preventing unauthorized access to business-sensitive service data.';