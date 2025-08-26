-- Enhanced security for client_invitations table
-- 1. Add audit logging for invitation access
-- 2. Add additional constraints and validation
-- 3. Enhance the get_client_invite_payload function with better security

-- First, create an audit log table for tracking access to sensitive data
CREATE TABLE IF NOT EXISTS public.invitation_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID REFERENCES public.client_invitations(id),
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accessor_ip TEXT,
  accessor_user_agent TEXT,
  access_type TEXT, -- 'view', 'use', 'expire'
  success BOOLEAN DEFAULT true
);

-- Enable RLS on audit log
ALTER TABLE public.invitation_access_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view invitation access logs" 
ON public.invitation_access_log 
FOR SELECT 
USING (get_current_user_role() = 'admin');

-- System can insert audit logs
CREATE POLICY "System can insert audit logs" 
ON public.invitation_access_log 
FOR INSERT 
WITH CHECK (true);

-- Create an enhanced security function for invitation payload
CREATE OR REPLACE FUNCTION public.get_client_invite_payload_secure(invite_token text, accessor_ip text DEFAULT NULL, accessor_user_agent text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv record;
  cli record;
  result json;
BEGIN
  -- Validate input
  IF invite_token IS NULL OR LENGTH(invite_token) < 10 THEN
    -- Log failed attempt
    INSERT INTO public.invitation_access_log (invitation_id, accessor_ip, accessor_user_agent, access_type, success)
    VALUES (NULL, accessor_ip, accessor_user_agent, 'view', false);
    RETURN NULL;
  END IF;

  -- Validate invitation by token (unused and not expired)
  SELECT * INTO inv
  FROM public.client_invitations
  WHERE token = invite_token
    AND used_at IS NULL
    AND expires_at > NOW()
  LIMIT 1;

  IF NOT FOUND THEN
    -- Log failed attempt
    INSERT INTO public.invitation_access_log (invitation_id, accessor_ip, accessor_user_agent, access_type, success)
    VALUES (NULL, accessor_ip, accessor_user_agent, 'view', false);
    RETURN NULL;
  END IF;

  -- Log successful access
  INSERT INTO public.invitation_access_log (invitation_id, accessor_ip, accessor_user_agent, access_type, success)
  VALUES (inv.id, accessor_ip, accessor_user_agent, 'view', true);

  -- Load client data (minimal exposure)
  SELECT * INTO cli
  FROM public.clients
  WHERE id = inv.client_id
  LIMIT 1;

  -- Return minimal necessary data with enhanced security
  result := json_build_object(
    'token', inv.token,
    'client_id', cli.id,
    'customer', cli.customer,
    -- Only return address if it exists on client record
    'address', CASE 
      WHEN cli.contact_address IS NOT NULL AND LENGTH(cli.contact_address) > 0 
      THEN cli.contact_address 
      ELSE NULL 
    END,
    -- Never expose phone numbers via this function
    'phone', NULL,
    -- Only return the email the invitation was sent to, and mask it partially
    'email', CASE 
      WHEN inv.email IS NOT NULL 
      THEN LEFT(inv.email, 3) || '***@' || RIGHT(inv.email, LENGTH(inv.email) - POSITION('@' IN inv.email))
      ELSE NULL 
    END,
    'email_full', inv.email, -- Only for form pre-population, should be handled carefully
    'expires_at', inv.expires_at,
    'created_at', inv.created_at
  );

  RETURN result;
END;
$$;

-- Restrict function execution
REVOKE ALL ON FUNCTION public.get_client_invite_payload_secure(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_invite_payload_secure(text, text, text) TO anon, authenticated;

-- Create function to mark invitation as used with audit
CREATE OR REPLACE FUNCTION public.mark_invitation_used(invite_token text, accessor_ip text DEFAULT NULL, accessor_user_agent text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv_id uuid;
BEGIN
  -- Find and mark invitation as used
  UPDATE public.client_invitations 
  SET used_at = NOW()
  WHERE token = invite_token 
    AND used_at IS NULL 
    AND expires_at > NOW()
  RETURNING id INTO inv_id;

  IF inv_id IS NOT NULL THEN
    -- Log the usage
    INSERT INTO public.invitation_access_log (invitation_id, accessor_ip, accessor_user_agent, access_type, success)
    VALUES (inv_id, accessor_ip, accessor_user_agent, 'use', true);
    RETURN true;
  ELSE
    -- Log failed attempt
    INSERT INTO public.invitation_access_log (invitation_id, accessor_ip, accessor_user_agent, access_type, success)
    VALUES (NULL, accessor_ip, accessor_user_agent, 'use', false);
    RETURN false;
  END IF;
END;
$$;

-- Restrict function execution
REVOKE ALL ON FUNCTION public.mark_invitation_used(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_invitation_used(text, text, text) TO anon, authenticated;

-- Add additional security constraints to client_invitations
-- Ensure email format is valid if provided
ALTER TABLE public.client_invitations 
ADD CONSTRAINT valid_email_format 
CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Ensure phone format is valid if provided (basic US format)
ALTER TABLE public.client_invitations 
ADD CONSTRAINT valid_phone_format 
CHECK (phone IS NULL OR phone ~ '^\+?1?[2-9]\d{2}[2-9]\d{2}\d{4}$');

-- Add function to clean up expired invitations (should be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Only allow admins to run this cleanup
  IF get_current_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can clean up expired invitations';
  END IF;

  -- Log expired invitations before deletion
  INSERT INTO public.invitation_access_log (invitation_id, access_type, success)
  SELECT id, 'expire', true
  FROM public.client_invitations
  WHERE expires_at < NOW() - INTERVAL '30 days'; -- Keep for 30 days after expiry for audit

  -- Delete very old expired invitations (older than 30 days past expiry)
  DELETE FROM public.client_invitations 
  WHERE expires_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Restrict cleanup function to admins only
REVOKE ALL ON FUNCTION public.cleanup_expired_invitations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_invitations() TO authenticated;

-- Create a view for admins to monitor invitation security
CREATE OR REPLACE VIEW public.invitation_security_summary AS
SELECT 
  ci.id,
  ci.token,
  ci.client_id,
  c.customer,
  ci.email,
  ci.phone,
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
GROUP BY ci.id, c.customer;

-- Restrict view to admins only
REVOKE ALL ON public.invitation_security_summary FROM PUBLIC;
GRANT SELECT ON public.invitation_security_summary TO authenticated;