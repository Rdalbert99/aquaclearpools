-- Harden client_invitations access to ensure invitation tokens are not publicly accessible
-- Idempotent: checks for existing policies and applies only missing pieces

-- 1) Ensure RLS is enabled
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;

-- 2) Ensure admin-only access policy exists for all operations (SELECT/INSERT/UPDATE/DELETE)
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

-- 3) Remove any chance of public/anon access via table privileges (keep authenticated to avoid breaking admin UI; RLS still enforces admin-only)
REVOKE ALL ON TABLE public.client_invitations FROM PUBLIC;
REVOKE ALL ON TABLE public.client_invitations FROM anon;

-- Note: We intentionally do not revoke from authenticated because RLS already restricts to admins only,
-- and some admin UIs may select/insert via the authenticated role.
