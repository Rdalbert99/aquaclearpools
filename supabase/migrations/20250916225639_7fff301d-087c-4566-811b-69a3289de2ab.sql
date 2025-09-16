-- Fix security vulnerability: Secure invitation_security_summary table
-- This table contains customer contact information and must be restricted

-- Enable Row Level Security on invitation_security_summary table
ALTER TABLE public.invitation_security_summary ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for invitation_security_summary table

-- 1. SELECT Policy: Only admins can view invitation security summaries
CREATE POLICY "invitation_security_summary_select_admin_only"
ON public.invitation_security_summary
FOR SELECT
TO authenticated
USING (
  get_current_user_role() = 'admin'
);

-- 2. INSERT Policy: Only admins can insert records (if needed by system)
CREATE POLICY "invitation_security_summary_insert_admin_only"
ON public.invitation_security_summary
FOR INSERT
TO authenticated
WITH CHECK (
  get_current_user_role() = 'admin'
);

-- 3. UPDATE Policy: Only admins can update records
CREATE POLICY "invitation_security_summary_update_admin_only"
ON public.invitation_security_summary
FOR UPDATE
TO authenticated
USING (
  get_current_user_role() = 'admin'
)
WITH CHECK (
  get_current_user_role() = 'admin'
);

-- 4. DELETE Policy: Only admins can delete records
CREATE POLICY "invitation_security_summary_delete_admin_only"
ON public.invitation_security_summary
FOR DELETE
TO authenticated
USING (
  get_current_user_role() = 'admin'
);

-- Add comment documenting security measures
COMMENT ON TABLE public.invitation_security_summary IS 'Invitation security summary with strict RLS. Contains customer contact information - admin access only with audit logging required.';

-- Create secure function for admin access to invitation summaries with audit logging
CREATE OR REPLACE FUNCTION public.admin_get_invitation_summaries(admin_reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  summaries_data json;
  user_role text;
BEGIN
  -- Verify admin role
  user_role := get_current_user_role();
  IF user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied: Only administrators can access invitation summaries';
  END IF;
  
  -- Validate reason is provided
  IF admin_reason IS NULL OR length(trim(admin_reason)) < 10 THEN
    RAISE EXCEPTION 'Admin reason must be provided and at least 10 characters';
  END IF;
  
  -- Log admin access
  PERFORM log_security_event(
    'admin_invitation_summary_access',
    auth.uid(),
    'invitation_security_summary',
    NULL,
    jsonb_build_object(
      'reason', admin_reason,
      'timestamp', now()
    )
  );
  
  -- Get invitation summaries
  SELECT json_agg(
    json_build_object(
      'id', id,
      'client_id', client_id,
      'customer', customer,
      'email_masked', email_masked,
      'phone_masked', phone_masked,
      'status', status,
      'created_at', created_at,
      'expires_at', expires_at,
      'used_at', used_at,
      'access_count', access_count,
      'last_accessed', last_accessed
    )
  ) INTO summaries_data
  FROM invitation_security_summary;
  
  RETURN COALESCE(summaries_data, '[]'::json);
END;
$$;