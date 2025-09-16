-- Remove the invitation_security_summary view completely
-- The functionality is properly handled by the admin_get_invitation_security_summary() function

DROP VIEW IF EXISTS public.invitation_security_summary;

-- Add a comment to document that invitation security data should only be accessed 
-- through the admin_get_invitation_security_summary() function with proper authorization
COMMENT ON FUNCTION public.admin_get_invitation_security_summary(text) IS 
'SECURITY: This function provides controlled access to invitation security data. Only admins can call this function, and all access is logged for audit purposes. This replaces the previous invitation_security_summary view to eliminate security definer issues.';