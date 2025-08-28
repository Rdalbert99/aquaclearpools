-- Secure invitation_security_summary by restricting access to admins only and masking PII
-- 1) Replace the view with a SECURITY INVOKER view that filters by app role
DROP VIEW IF EXISTS public.invitation_security_summary;

CREATE VIEW public.invitation_security_summary
WITH (security_invoker = true)
AS
SELECT 
  ci.id,
  ci.client_id,
  c.customer,
  -- Mask email (keep first 3 chars and domain)
  CASE 
    WHEN ci.email IS NOT NULL AND POSITION('@' IN ci.email) > 0 THEN 
      LEFT(ci.email, 3) || '***@' || SPLIT_PART(ci.email, '@', 2)
    ELSE NULL 
  END AS email_masked,
  -- Mask phone (last 4 visible)
  CASE 
    WHEN ci.phone IS NOT NULL AND LENGTH(ci.phone) > 4 THEN 
      repeat('*', GREATEST(LENGTH(ci.phone) - 4, 0)) || RIGHT(ci.phone, 4)
    WHEN ci.phone IS NOT NULL THEN ci.phone
    ELSE NULL
  END AS phone_masked,
  ci.created_at,
  ci.expires_at,
  ci.used_at,
  CASE 
    WHEN ci.used_at IS NOT NULL THEN 'used'
    WHEN ci.expires_at < NOW() THEN 'expired'
    ELSE 'active'
  END AS status,
  COUNT(ial.id) AS access_count,
  MAX(ial.accessed_at) AS last_accessed
FROM public.client_invitations ci
LEFT JOIN public.clients c ON ci.client_id = c.id
LEFT JOIN public.invitation_access_log ial ON ci.id = ial.invitation_id
-- Ensure only admins see rows when querying with anon key
WHERE public.get_current_user_role() = 'admin'
GROUP BY ci.id, c.customer;

-- 2) Lock down privileges on the view
REVOKE ALL ON public.invitation_security_summary FROM PUBLIC;
GRANT SELECT ON public.invitation_security_summary TO authenticated;
-- Allow service role as well for server-side diagnostics if needed
GRANT SELECT ON public.invitation_security_summary TO service_role;

COMMENT ON VIEW public.invitation_security_summary IS 'Admin-only summary of client invitations with masked contact info. SECURITY INVOKER and role filter applied.';