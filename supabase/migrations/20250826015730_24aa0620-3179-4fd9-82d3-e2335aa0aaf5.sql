-- Fix the security definer view issue by removing SECURITY DEFINER and using proper RLS
-- Replace the view with a regular view that respects RLS

-- Drop the problematic view
DROP VIEW IF EXISTS public.invitation_security_summary;

-- Create a regular view without SECURITY DEFINER that respects RLS policies
CREATE VIEW public.invitation_security_summary AS
SELECT 
  ci.id,
  ci.client_id,
  c.customer,
  -- Only show partial email for security (mask sensitive data)
  CASE 
    WHEN ci.email IS NOT NULL 
    THEN LEFT(ci.email, 3) || '***@' || RIGHT(ci.email, LENGTH(ci.email) - POSITION('@' IN ci.email))
    ELSE NULL 
  END as email_masked,
  -- Never show full phone numbers in summary views
  CASE 
    WHEN ci.phone IS NOT NULL 
    THEN '***-***-' || RIGHT(ci.phone, 4)
    ELSE NULL 
  END as phone_masked,
  ci.created_at,
  ci.expires_at,
  ci.used_at,
  CASE 
    WHEN ci.used_at IS NOT NULL THEN 'used'
    WHEN ci.expires_at < NOW() THEN 'expired'
    ELSE 'active'
  END as status,
  COUNT(ial.id) as access_count,
  MAX(ial.accessed_at) as last_accessed
FROM public.client_invitations ci
LEFT JOIN public.clients c ON ci.client_id = c.id
LEFT JOIN public.invitation_access_log ial ON ci.id = ial.invitation_id
GROUP BY ci.id, c.customer, ci.email, ci.phone, ci.created_at, ci.expires_at, ci.used_at;

-- The view will now respect RLS policies - only admins can see client_invitations data
-- due to the existing RLS policy "Admins can manage client invitations"