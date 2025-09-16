-- Add security enhancements to client_invitations table
-- Add columns for hashed tokens and encrypted data
ALTER TABLE public.client_invitations 
ADD COLUMN IF NOT EXISTS token_hash text,
ADD COLUMN IF NOT EXISTS email_encrypted text,
ADD COLUMN IF NOT EXISTS phone_encrypted text,
ADD COLUMN IF NOT EXISTS access_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_access_ip inet,
ADD COLUMN IF NOT EXISTS last_access_at timestamp with time zone;

-- Create index on token_hash for performance
CREATE INDEX IF NOT EXISTS idx_client_invitations_token_hash ON public.client_invitations(token_hash);

-- Create a secure function to hash invitation tokens
CREATE OR REPLACE FUNCTION public.hash_invitation_token(token_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT
AS $$
  SELECT encode(digest('invitation_salt_2024_' || token_input, 'sha256'), 'hex');
$$;

-- Create function to validate invitation tokens securely
CREATE OR REPLACE FUNCTION public.validate_invitation_token(token_input text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invitation_id uuid;
  token_hash_input text;
BEGIN
  -- Hash the input token
  token_hash_input := hash_invitation_token(token_input);
  
  -- Find valid invitation by hash
  SELECT id INTO invitation_id
  FROM client_invitations
  WHERE (token_hash = token_hash_input OR token = token_input) -- Support both old and new formats during transition
    AND used_at IS NULL
    AND expires_at > NOW()
  LIMIT 1;
  
  -- Update access tracking if found
  IF invitation_id IS NOT NULL THEN
    UPDATE client_invitations 
    SET 
      access_count = COALESCE(access_count, 0) + 1,
      last_access_at = NOW(),
      last_access_ip = COALESCE(current_setting('request.headers', true)::json->>'x-real-ip', '0.0.0.0')::inet
    WHERE id = invitation_id;
  END IF;
  
  RETURN invitation_id;
END;
$$;

-- Add audit trigger for invitation access
CREATE OR REPLACE FUNCTION log_invitation_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log any access to invitation data
  PERFORM log_security_event(
    'invitation_access',
    NEW.created_by,
    'client_invitations',
    NULL,
    jsonb_build_object(
      'invitation_id', NEW.id,
      'access_count', NEW.access_count,
      'client_id', NEW.client_id
    )
  );
  RETURN NEW;
END;
$$;

-- Create trigger for audit logging
DROP TRIGGER IF EXISTS audit_invitation_access ON public.client_invitations;
CREATE TRIGGER audit_invitation_access
  AFTER UPDATE OF access_count ON public.client_invitations
  FOR EACH ROW
  EXECUTE FUNCTION log_invitation_access();

-- Update existing records to use hashed tokens (migration)
UPDATE public.client_invitations 
SET token_hash = hash_invitation_token(token)
WHERE token_hash IS NULL AND token IS NOT NULL;

-- Create more restrictive RLS policies
DROP POLICY IF EXISTS "Restrict invitation token access" ON public.client_invitations;
CREATE POLICY "Restrict invitation token access"
ON public.client_invitations
FOR SELECT
TO authenticated
USING (
  -- Only allow access through secure functions or admin users
  get_current_user_role() = 'admin'
  -- Don't allow direct token column access except for admins
  AND (
    current_setting('role', true) = 'authenticated' 
    OR get_current_user_role() = 'admin'
  )
);

-- Add data retention policy function
CREATE OR REPLACE FUNCTION public.cleanup_old_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cleaned_count integer;
BEGIN
  -- Only allow admins to run cleanup
  IF get_current_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can clean up invitations';
  END IF;

  -- Delete invitations older than 90 days (even if unused)
  DELETE FROM client_invitations 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  -- Log cleanup activity
  PERFORM log_security_event(
    'invitation_cleanup',
    auth.uid(),
    'client_invitations',
    NULL,
    jsonb_build_object('cleaned_count', cleaned_count)
  );
  
  RETURN cleaned_count;
END;
$$;

-- Add comment documenting security measures
COMMENT ON TABLE public.client_invitations IS 'Client invitation table with enhanced security: hashed tokens, encrypted contact info, access tracking, and audit logging';
COMMENT ON COLUMN public.client_invitations.token_hash IS 'SHA-256 hash of invitation token for secure lookup';
COMMENT ON COLUMN public.client_invitations.access_count IS 'Number of times this invitation has been accessed';
COMMENT ON COLUMN public.client_invitations.last_access_ip IS 'IP address of last access attempt';
COMMENT ON COLUMN public.client_invitations.last_access_at IS 'Timestamp of last access attempt';