-- Fix previous failure: invitation_security_summary is a view; lock it down via privileges instead of RLS

REVOKE ALL ON VIEW public.invitation_security_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON VIEW public.invitation_security_summary TO service_role;