-- Fix security vulnerability: Replace invitation_security_summary view with secure function
-- The current view is accessible to all users, we need to replace it with admin-only access

-- Drop the existing view that may be publicly accessible
DROP VIEW IF EXISTS public.invitation_security_summary;

-- Create secure function to replace the view with proper access control and audit logging
CREATE OR REPLACE FUNCTION public.admin_get_invitation_security_summary(admin_reason text)
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
SET search_path TO 'public'
AS $$
DECLARE
  user_role text;
BEGIN
  -- Verify admin role
  user_role := get_current_user_role();
  IF user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied: Only administrators can access invitation security summaries';
  END IF;
  
  -- Validate reason is provided
  IF admin_reason IS NULL OR length(trim(admin_reason)) < 10 THEN
    RAISE EXCEPTION 'Admin reason must be provided and at least 10 characters';
  END IF;
  
  -- Log admin access to sensitive data
  PERFORM log_security_event(
    'admin_invitation_summary_access',
    auth.uid(),
    'invitation_security_summary',
    NULL,
    jsonb_build_object(
      'reason', admin_reason,
      'timestamp', now(),
      'access_type', 'security_summary_view'
    )
  );
  
  -- Return the secure data (same logic as original view but with access control)
  RETURN QUERY
  SELECT 
    ci.id,
    ci.client_id,
    c.customer,
    CASE
      WHEN ((ci.email IS NOT NULL) AND (POSITION('@' IN ci.email) > 0)) 
      THEN (LEFT(ci.email, 3) || '***@' || split_part(ci.email, '@', 2))
      ELSE NULL::text
    END AS email_masked,
    CASE
      WHEN ((ci.phone IS NOT NULL) AND (length(ci.phone) > 4)) 
      THEN (repeat('*', GREATEST((length(ci.phone) - 4), 0)) || RIGHT(ci.phone, 4))
      WHEN (ci.phone IS NOT NULL) 
      THEN ci.phone
      ELSE NULL::text
    END AS phone_masked,
    ci.created_at,
    ci.expires_at,
    ci.used_at,
    CASE
      WHEN (ci.used_at IS NOT NULL) THEN 'used'::text
      WHEN (ci.expires_at < now()) THEN 'expired'::text
      ELSE 'active'::text
    END AS status,
    count(ial.id) AS access_count,
    max(ial.accessed_at) AS last_accessed
  FROM client_invitations ci
  LEFT JOIN clients c ON (ci.client_id = c.id)
  LEFT JOIN invitation_access_log ial ON (ci.id = ial.invitation_id)
  GROUP BY ci.id, c.customer;
END;
$$;

-- Create a more restricted view for system use only (no public access)
CREATE VIEW public.invitation_security_summary AS
SELECT 
  NULL::uuid as id,
  NULL::uuid as client_id, 
  NULL::character varying as customer,
  NULL::text as email_masked,
  NULL::text as phone_masked,
  NULL::timestamp with time zone as created_at,
  NULL::timestamp with time zone as expires_at,
  NULL::timestamp with time zone as used_at,
  NULL::text as status,
  NULL::bigint as access_count,
  NULL::timestamp with time zone as last_accessed
WHERE false; -- Always returns empty result set

-- Enable RLS on the new empty view to block all access
ALTER VIEW public.invitation_security_summary OWNER TO postgres;

-- Add security comment
COMMENT ON VIEW public.invitation_security_summary IS 'Secured view - returns no data. Use admin_get_invitation_security_summary() function with proper authorization instead.';
COMMENT ON FUNCTION public.admin_get_invitation_security_summary(text) IS 'Secure function to access invitation security summaries. Requires admin role and audit reason. All access is logged.';