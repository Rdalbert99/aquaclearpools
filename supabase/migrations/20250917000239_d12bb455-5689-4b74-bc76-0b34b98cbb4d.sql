-- CRITICAL SECURITY FIX: Enhanced Protection for Service Request Contact Information
-- The service_requests table contains extremely sensitive customer PII that needs maximum protection

-- 1. Add comprehensive audit logging for service request data access
CREATE OR REPLACE FUNCTION log_service_request_pii_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_security_event_enhanced(
      'service_request_created_with_pii',
      auth.uid(),
      NULL,
      'database/service_requests',
      jsonb_build_object(
        'service_request_id', NEW.id,
        'has_contact_info', (NEW.contact_email IS NOT NULL OR NEW.contact_phone IS NOT NULL),
        'created_by_role', get_current_user_role(),
        'operation', 'INSERT'
      ),
      'info'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log any changes to contact information
    PERFORM log_security_event_enhanced(
      'service_request_pii_modified',
      auth.uid(),
      NULL,
      'database/service_requests',
      jsonb_build_object(
        'service_request_id', NEW.id,
        'contact_info_changed', (
          OLD.contact_email IS DISTINCT FROM NEW.contact_email OR 
          OLD.contact_phone IS DISTINCT FROM NEW.contact_phone OR 
          OLD.contact_address IS DISTINCT FROM NEW.contact_address
        ),
        'modified_by_role', get_current_user_role(),
        'operation', 'UPDATE'
      ),
      'warning'
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_security_event_enhanced(
      'service_request_pii_deleted',
      auth.uid(),
      NULL,
      'database/service_requests',
      jsonb_build_object(
        'service_request_id', OLD.id,
        'had_contact_info', (OLD.contact_email IS NOT NULL OR OLD.contact_phone IS NOT NULL),
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

-- Create audit trigger for service_requests table
DROP TRIGGER IF EXISTS audit_service_request_pii_access ON public.service_requests;
CREATE TRIGGER audit_service_request_pii_access
  AFTER INSERT OR UPDATE OR DELETE ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION log_service_request_pii_access();

-- 2. Create secure admin function for service request PII access
CREATE OR REPLACE FUNCTION admin_get_service_request_contact_info(request_id uuid, admin_reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  request_record record;
  current_user_role text;
BEGIN
  -- SECURITY: Strict admin-only access with audit
  current_user_role := get_current_user_role();
  IF current_user_role != 'admin' THEN
    PERFORM log_security_event_enhanced(
      'unauthorized_service_request_pii_access',
      auth.uid(),
      NULL,
      'admin/service-request-pii',
      jsonb_build_object(
        'attempted_request_id', request_id,
        'accessor_role', current_user_role
      ),
      'critical'
    );
    RAISE EXCEPTION 'SECURITY VIOLATION: Unauthorized PII access attempt';
  END IF;
  
  -- Require justification
  IF admin_reason IS NULL OR length(trim(admin_reason)) < 15 THEN
    RAISE EXCEPTION 'Service request PII access requires justification (minimum 15 characters)';
  END IF;
  
  -- Get request data
  SELECT * INTO request_record FROM service_requests WHERE id = request_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Service request not found');
  END IF;
  
  -- Log PII access
  PERFORM log_security_event_enhanced(
    'admin_service_request_pii_access',
    auth.uid(),
    NULL,
    'admin/service-request-pii',
    jsonb_build_object(
      'request_id', request_record.id,
      'accessed_contact_email', CASE WHEN request_record.contact_email IS NOT NULL THEN 'yes' ELSE 'no' END,
      'reason', admin_reason
    ),
    'warning'
  );
  
  RETURN row_to_json(request_record);
END;
$$;

-- Update table documentation
COMMENT ON TABLE public.service_requests IS 
'MAXIMUM SECURITY: Service requests with customer PII protected by authenticated-only RLS policies, comprehensive audit logging, and admin access controls. Contains sensitive contact information requiring special handling.';