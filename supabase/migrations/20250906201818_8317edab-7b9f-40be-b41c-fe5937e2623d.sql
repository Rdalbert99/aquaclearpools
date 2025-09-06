-- Harden RLS for client_invitations without breaking existing flows
-- Enforce (idempotent if already applied)
ALTER TABLE IF EXISTS public.client_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.client_invitations FORCE ROW LEVEL SECURITY;

-- Drop legacy broad policy if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'client_invitations' 
      AND policyname = 'Admins can manage client invitations'
  ) THEN
    DROP POLICY "Admins can manage client invitations" ON public.client_invitations;
  END IF;
END $$;

-- Create explicit, least-privilege policies
-- SELECT
CREATE POLICY "Admins can view client invitations"
ON public.client_invitations
FOR SELECT
USING (public.get_current_user_role() = 'admin');

-- INSERT
CREATE POLICY "Admins can create client invitations"
ON public.client_invitations
FOR INSERT
WITH CHECK (public.get_current_user_role() = 'admin');

-- UPDATE
CREATE POLICY "Admins can update client invitations"
ON public.client_invitations
FOR UPDATE
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- DELETE
CREATE POLICY "Admins can delete client invitations"
ON public.client_invitations
FOR DELETE
USING (public.get_current_user_role() = 'admin');

-- Notes:
-- 1) Public/clients never get direct access to this table; they use
--    security-definer functions (e.g., get_client_invite_payload_secure)
-- 2) Edge functions using the service role bypass RLS as intended
