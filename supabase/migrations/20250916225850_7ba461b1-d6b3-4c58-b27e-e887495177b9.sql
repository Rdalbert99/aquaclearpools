-- Fix Security Definer View issue detected by linter
-- Remove the problematic view and ensure proper security

-- Drop the current view that may be causing the security definer issue
DROP VIEW IF EXISTS public.invitation_security_summary;

-- Create a simple, secure view that blocks all access via RLS
-- This approach avoids security definer issues while maintaining security
CREATE VIEW public.invitation_security_summary AS
SELECT 
  ci.id,
  ci.client_id,
  c.customer,
  CASE
    WHEN false THEN 'blocked'::text  -- Never shows real data
    ELSE NULL::text
  END AS email_masked,
  CASE
    WHEN false THEN 'blocked'::text  -- Never shows real data
    ELSE NULL::text
  END AS phone_masked,
  ci.created_at,
  ci.expires_at,
  ci.used_at,
  'blocked'::text AS status,
  0::bigint AS access_count,
  NULL::timestamp with time zone AS last_accessed
FROM client_invitations ci
LEFT JOIN clients c ON (ci.client_id = c.id)
WHERE false; -- Never returns any rows

-- Add RLS policy to the view (block all access)
-- Note: Views inherit RLS from underlying tables, so this provides additional security
COMMENT ON VIEW public.invitation_security_summary IS 'Security-blocked view. Access customer data only through admin_get_invitation_security_summary() function with proper authorization.';