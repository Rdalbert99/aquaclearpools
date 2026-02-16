
-- Create tech_invitations table
CREATE TABLE public.tech_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text,
  phone text,
  token text NOT NULL,
  token_hash text,
  invited_by uuid REFERENCES public.users(id),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tech_invitations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage tech invitations
CREATE POLICY "tech_invitations_select_admin_only"
  ON public.tech_invitations FOR SELECT
  USING (get_current_user_role() = 'admin');

CREATE POLICY "tech_invitations_insert_admin_only"
  ON public.tech_invitations FOR INSERT
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "tech_invitations_update_admin_only"
  ON public.tech_invitations FOR UPDATE
  USING (get_current_user_role() = 'admin');

CREATE POLICY "tech_invitations_delete_admin_only"
  ON public.tech_invitations FOR DELETE
  USING (get_current_user_role() = 'admin');

-- Function to validate tech invitation token (public access needed for signup)
CREATE OR REPLACE FUNCTION public.validate_tech_invitation_token(token_input text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv record;
BEGIN
  IF token_input IS NULL OR LENGTH(token_input) < 10 THEN
    RETURN json_build_object('error', 'Invalid token');
  END IF;

  SELECT * INTO inv
  FROM tech_invitations
  WHERE token = token_input
    AND used_at IS NULL
    AND expires_at > NOW()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid or expired invitation');
  END IF;

  RETURN json_build_object(
    'valid', true,
    'email', inv.email,
    'phone', inv.phone,
    'expires_at', inv.expires_at
  );
END;
$$;
