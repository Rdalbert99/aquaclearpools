-- Harden access to client invitations PII and related RPCs without breaking existing flows

-- 1) Ensure strict admin-only access via RLS on client_invitations (idempotent)
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'client_invitations' 
      AND policyname = 'Admins can manage client invitations'
  ) THEN
    CREATE POLICY "Admins can manage client invitations"
    ON public.client_invitations
    FOR ALL
    USING (public.get_current_user_role() = 'admin')
    WITH CHECK (public.get_current_user_role() = 'admin');
  END IF;
END $$;

-- 2) Lock down the legacy RPC that returns full email
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' 
      AND p.proname = 'get_client_invite_payload'
      AND pg_get_function_identity_arguments(p.oid) = 'invite_token text'
  ) THEN
    REVOKE ALL ON FUNCTION public.get_client_invite_payload(text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.get_client_invite_payload(text) TO service_role;
  END IF;
END $$;

-- 3) Keep the secure RPC callable by clients but not PUBLIC
REVOKE ALL ON FUNCTION public.get_client_invite_payload_secure(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_invite_payload_secure(text, text, text) TO anon, authenticated;

-- 4) Add admin-only RLS to invitation_security_summary to avoid metadata leakage (idempotent)
--    This table only contains masked fields but should still be staff-only.
ALTER TABLE public.invitation_security_summary ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'invitation_security_summary' 
      AND policyname = 'Admins can view invitation summary'
  ) THEN
    CREATE POLICY "Admins can view invitation summary"
    ON public.invitation_security_summary
    FOR SELECT
    USING (public.get_current_user_role() = 'admin');
  END IF;
END $$;