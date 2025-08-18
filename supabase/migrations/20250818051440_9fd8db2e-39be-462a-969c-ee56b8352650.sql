-- Security fix: remove public read access to client_invitations
-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;

-- Drop overly permissive public SELECT policy exposing PII
DROP POLICY IF EXISTS "Public can complete valid invitations" ON public.client_invitations;

-- Keep admin access via existing policy "Admins can manage client invitations"
-- No replacement public policy is added; anonymous and authenticated users cannot read this table directly.
-- Frontend continues using SECURITY DEFINER RPC get_client_invite_payload(invite_token text)
-- and the complete-client-invite edge function (service role) for invite flows.
