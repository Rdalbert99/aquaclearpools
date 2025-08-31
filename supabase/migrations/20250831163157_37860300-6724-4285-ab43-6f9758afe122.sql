-- Strengthen invitation payload function to avoid exposing full email
-- 1) Replace secure RPC to exclude full email and phone
CREATE OR REPLACE FUNCTION public.get_client_invite_payload_secure(
  invite_token text,
  accessor_ip text DEFAULT NULL,
  accessor_user_agent text DEFAULT NULL
)
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
  IF invite_token IS NULL OR LENGTH(invite_token) < 10 THEN
    INSERT INTO public.invitation_access_log (invitation_id, accessor_ip, accessor_user_agent, access_type, success)
    VALUES (NULL, accessor_ip, accessor_user_agent, 'view', false);
    RETURN NULL;
  END IF;

  SELECT * INTO inv
  FROM public.client_invitations
  WHERE token = invite_token
    AND used_at IS NULL
    AND expires_at > NOW()
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.invitation_access_log (invitation_id, accessor_ip, accessor_user_agent, access_type, success)
    VALUES (NULL, accessor_ip, accessor_user_agent, 'view', false);
    RETURN NULL;
  END IF;

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

-- 2) Tighten function execution privileges
REVOKE ALL ON FUNCTION public.get_client_invite_payload_secure(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_invite_payload_secure(text, text, text) TO anon, authenticated;

-- 3) Ensure non-secure variant cannot be called publicly
DO $$ BEGIN
  PERFORM 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_client_invite_payload';
  IF FOUND THEN
    REVOKE ALL ON FUNCTION public.get_client_invite_payload(text) FROM PUBLIC;
  END IF;
END $$;