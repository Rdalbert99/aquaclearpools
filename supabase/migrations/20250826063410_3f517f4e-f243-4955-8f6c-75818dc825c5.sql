-- Fix security definer view issue by explicitly setting SECURITY INVOKER
-- This ensures the view runs with the permissions of the querying user, not the creator

-- Drop and recreate the invitation_security_summary view with SECURITY INVOKER
DROP VIEW IF EXISTS public.invitation_security_summary;

CREATE VIEW public.invitation_security_summary
WITH (security_invoker = true)
AS
SELECT 
    ci.id,
    ci.client_id,
    c.customer,
    CASE
        WHEN ci.email IS NOT NULL THEN (left(ci.email, 3) || '***@') || right(ci.email, length(ci.email) - POSITION('@' IN ci.email))
        ELSE NULL
    END AS email_masked,
    CASE
        WHEN ci.phone IS NOT NULL THEN '***-***-' || right(ci.phone, 4)
        ELSE NULL
    END AS phone_masked,
    ci.created_at,
    ci.expires_at,
    ci.used_at,
    CASE
        WHEN ci.used_at IS NOT NULL THEN 'used'
        WHEN ci.expires_at < now() THEN 'expired'
        ELSE 'active'
    END AS status,
    count(ial.id) AS access_count,
    max(ial.accessed_at) AS last_accessed
FROM client_invitations ci
LEFT JOIN clients c ON ci.client_id = c.id
LEFT JOIN invitation_access_log ial ON ci.id = ial.invitation_id
GROUP BY ci.id, c.customer, ci.email, ci.phone, ci.created_at, ci.expires_at, ci.used_at;