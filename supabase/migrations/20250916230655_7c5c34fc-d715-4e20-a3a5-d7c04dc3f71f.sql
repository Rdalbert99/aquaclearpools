-- Fix Security Definer View linter error
-- Change our public view to use security_invoker instead of security_definer
-- This resolves the linter warning while maintaining security

-- Update our view to use invoker security model
ALTER VIEW public.invitation_summary_admin SET (security_invoker = true);

-- Add updated documentation
COMMENT ON VIEW public.invitation_summary_admin IS 'Secure empty view with security_invoker=true. Customer data access only through admin_get_invitation_security_summary() function with proper authentication and audit logging.';