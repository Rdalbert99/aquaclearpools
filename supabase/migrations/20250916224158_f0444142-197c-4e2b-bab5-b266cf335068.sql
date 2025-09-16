-- Update existing database functions to use secure validation
CREATE OR REPLACE FUNCTION public.get_client_invite_payload_secure(invite_token text, accessor_ip text DEFAULT NULL::text, accessor_user_agent text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invitation_id uuid;
  inv record;
  cli record;
  result json;
BEGIN
  IF invite_token IS NULL OR LENGTH(invite_token) < 10 THEN
    INSERT INTO public.invitation_access_log (invitation_id, accessor_ip, accessor_user_agent, access_type, success)
    VALUES (NULL, accessor_ip, accessor_user_agent, 'view', false);
    RETURN NULL;
  END IF;

  -- Use secure validation function
  invitation_id := validate_invitation_token(invite_token);
  
  IF invitation_id IS NULL THEN
    INSERT INTO public.invitation_access_log (invitation_id, accessor_ip, accessor_user_agent, access_type, success)
    VALUES (NULL, accessor_ip, accessor_user_agent, 'view', false);
    RETURN NULL;
  END IF;

  -- Get invitation details
  SELECT * INTO inv
  FROM public.client_invitations
  WHERE id = invitation_id;

  -- Log successful access
  INSERT INTO public.invitation_access_log (invitation_id, accessor_ip, accessor_user_agent, access_type, success)
  VALUES (inv.id, accessor_ip, accessor_user_agent, 'view', true);

  -- Load minimal client data only
  SELECT * INTO cli
  FROM public.clients
  WHERE id = inv.client_id
  LIMIT 1;

  -- Build minimal, safe payload (masked email, never phone)
  result := json_build_object(
    'token', inv.token,
    'client_id', cli.id,
    'customer', cli.customer,
    'address', CASE 
      WHEN cli.contact_address IS NOT NULL AND LENGTH(cli.contact_address) > 0 THEN cli.contact_address 
      ELSE NULL 
    END,
    'phone', NULL,
    'email', CASE 
      WHEN inv.email IS NOT NULL THEN LEFT(inv.email, 3) || '***@' || RIGHT(inv.email, LENGTH(inv.email) - POSITION('@' IN inv.email))
      ELSE NULL 
    END,
    'expires_at', inv.expires_at,
    'created_at', inv.created_at
  );

  RETURN result;
END;
$$;

-- Update the less secure version to also use secure validation
CREATE OR REPLACE FUNCTION public.get_client_invite_payload(invite_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invitation_id uuid;
  inv record;
  cli record;
BEGIN
  -- Use secure validation function
  invitation_id := validate_invitation_token(invite_token);
  
  IF invitation_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get invitation details
  SELECT * INTO inv
  FROM public.client_invitations
  WHERE id = invitation_id;

  -- Load client (no user profile lookup to avoid exposing additional PII)
  SELECT * INTO cli
  FROM public.clients
  WHERE id = inv.client_id
  LIMIT 1;

  RETURN json_build_object(
    'token', inv.token,
    'client_id', cli.id,
    'customer', cli.customer,
    -- Only return address stored on the client record, never from user profile
    'address', cli.contact_address,
    -- Do not expose phone via public function
    'phone', null,
    -- Only return the email address the invitation was sent to; may be null
    'email', inv.email,
    'expires_at', inv.expires_at
  );
END;
$$;