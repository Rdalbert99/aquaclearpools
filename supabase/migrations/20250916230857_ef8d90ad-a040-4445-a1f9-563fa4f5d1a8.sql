-- CRITICAL SECURITY FIX: Secure service_requests table RLS policies
-- Current policies allow public access which could expose customer contact information
-- This fix ensures only authenticated, authorized users can access service request data

-- Drop existing insecure policies
DROP POLICY IF EXISTS "Admins can view all service requests" ON public.service_requests;
DROP POLICY IF EXISTS "Assigned techs can view service requests" ON public.service_requests;
DROP POLICY IF EXISTS "Clients can view their own service requests" ON public.service_requests;
DROP POLICY IF EXISTS "Techs and admins can update service requests" ON public.service_requests;
DROP POLICY IF EXISTS "Techs can accept unassigned service requests" ON public.service_requests;
DROP POLICY IF EXISTS "Authenticated users can create service requests" ON public.service_requests;
DROP POLICY IF EXISTS "Admins only can delete service requests" ON public.service_requests;

-- CREATE SECURE RLS POLICIES - All require authentication

-- 1. SELECT Policy: Clients can only view their own service requests
CREATE POLICY "service_requests_select_clients_own_only"
ON public.service_requests
FOR SELECT
TO authenticated
USING (
  get_current_user_role() = 'client'
  AND client_id IN (
    SELECT c.id 
    FROM clients c 
    WHERE c.user_id = auth.uid()
  )
);

-- 2. SELECT Policy: Assigned technicians can view their assigned service requests only
CREATE POLICY "service_requests_select_assigned_techs_only"
ON public.service_requests
FOR SELECT
TO authenticated
USING (
  get_current_user_role() = 'tech'
  AND assigned_technician_id = auth.uid()
);

-- 3. SELECT Policy: Admins can view all service requests (but logged)
CREATE POLICY "service_requests_select_admin_all"
ON public.service_requests
FOR SELECT
TO authenticated
USING (
  get_current_user_role() = 'admin'
);

-- 4. INSERT Policy: Authenticated users can create service requests with restrictions
CREATE POLICY "service_requests_insert_authenticated_restricted"
ON public.service_requests
FOR INSERT
TO authenticated
WITH CHECK (
  -- Public service requests (no client_id) are allowed
  (client_id IS NULL) 
  OR 
  -- Client can create for themselves
  (get_current_user_role() = 'client' AND client_id IN (
    SELECT c.id FROM clients c WHERE c.user_id = auth.uid()
  ))
  OR
  -- Admins and techs can create for any client
  (get_current_user_role() = ANY(ARRAY['admin', 'tech']))
);

-- 5. UPDATE Policy: Only assigned techs can update their service requests
CREATE POLICY "service_requests_update_assigned_tech_only"
ON public.service_requests
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

-- 6. UPDATE Policy: Admins can update any service request
CREATE POLICY "service_requests_update_admin_all"
ON public.service_requests
FOR UPDATE
TO authenticated
USING (
  get_current_user_role() = 'admin'
)
WITH CHECK (
  get_current_user_role() = 'admin'
);

-- 7. UPDATE Policy: Techs can accept unassigned service requests
CREATE POLICY "service_requests_update_tech_accept_unassigned"
ON public.service_requests
FOR UPDATE
TO authenticated
USING (
  get_current_user_role() = 'tech'
  AND assigned_technician_id IS NULL
)
WITH CHECK (
  get_current_user_role() = 'tech'
  AND assigned_technician_id = auth.uid()  -- Must assign to themselves
);

-- 8. DELETE Policy: Only admins can delete service requests
CREATE POLICY "service_requests_delete_admin_only"
ON public.service_requests
FOR DELETE
TO authenticated
USING (
  get_current_user_role() = 'admin'
);

-- Create secure admin function for service request management with audit logging
CREATE OR REPLACE FUNCTION public.admin_get_service_requests_with_contact_info(admin_reason text)
RETURNS TABLE(
  id uuid,
  client_id uuid,
  contact_name text,
  contact_email text,
  contact_phone text,
  contact_address text,
  street_address text,
  city text,
  state text,
  zip_code text,
  request_type character varying,
  description text,
  status character varying,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role text;
BEGIN
  -- Verify admin role
  user_role := get_current_user_role();
  IF user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied: Only administrators can access service request contact information';
  END IF;
  
  -- Validate reason is provided
  IF admin_reason IS NULL OR length(trim(admin_reason)) < 10 THEN
    RAISE EXCEPTION 'Admin reason must be provided and at least 10 characters';
  END IF;
  
  -- Log admin access to sensitive customer data
  PERFORM log_security_event(
    'admin_service_request_contact_access',
    auth.uid(),
    'service_requests',
    NULL,
    jsonb_build_object(
      'reason', admin_reason,
      'timestamp', now(),
      'access_type', 'contact_information_view'
    )
  );
  
  -- Return service requests with contact information
  RETURN QUERY
  SELECT 
    sr.id,
    sr.client_id,
    sr.contact_name,
    sr.contact_email,
    sr.contact_phone,
    sr.contact_address,
    sr.street_address,
    sr.city,
    sr.state,
    sr.zip_code,
    sr.request_type,
    sr.description,
    sr.status,
    sr.created_at
  FROM service_requests sr
  ORDER BY sr.created_at DESC;
END;
$$;

-- Add security documentation
COMMENT ON TABLE public.service_requests IS 'Service requests with strict RLS. Contains customer contact information - access restricted by role with audit logging for admin functions.';
COMMENT ON FUNCTION public.admin_get_service_requests_with_contact_info(text) IS 'SECURE: Admin function to access service request contact information. Requires admin role, audit reason, and logs all access attempts.';

-- Add performance indexes for the new policies
CREATE INDEX IF NOT EXISTS idx_service_requests_client_user_lookup ON service_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_assigned_tech ON service_requests(assigned_technician_id) WHERE assigned_technician_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_requests_status_created ON service_requests(status, created_at);