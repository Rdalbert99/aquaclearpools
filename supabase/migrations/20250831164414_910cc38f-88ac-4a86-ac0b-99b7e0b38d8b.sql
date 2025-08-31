-- Fix SQL syntax and complete client_invitations hardening
-- Error was in mixing PUBLIC, anon, and authenticated in one command; separate them

-- 1) Lock down invitation_security_summary view with proper syntax
REVOKE ALL ON public.invitation_security_summary FROM PUBLIC;
REVOKE ALL ON public.invitation_security_summary FROM anon;
REVOKE ALL ON public.invitation_security_summary FROM authenticated;
GRANT SELECT ON public.invitation_security_summary TO service_role;