-- Secure invitation_security_summary from non-admin access
-- This migration is idempotent and handles both table and view cases safely

DO $$
DECLARE
  obj_kind char;
BEGIN
  SELECT c.relkind INTO obj_kind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'invitation_security_summary';

  -- If it's a regular table ('r'): enable RLS and add admin-only SELECT policy
  IF obj_kind = 'r' THEN
    -- Enable RLS (safe if already enabled)
    EXECUTE 'ALTER TABLE public.invitation_security_summary ENABLE ROW LEVEL SECURITY';

    -- Create admin-only select policy if not exists
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

    -- Note: We intentionally do NOT revoke SELECT from authenticated here; RLS enforces admin-only access.

  -- If it's a view ('v') or materialized view ('m'): RLS doesn't apply, so restrict via privileges
  ELSIF obj_kind IN ('v', 'm') THEN
    -- Lock down privileges to server-side only (service_role)
    EXECUTE 'REVOKE ALL ON public.invitation_security_summary FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON public.invitation_security_summary FROM anon';
    EXECUTE 'REVOKE ALL ON public.invitation_security_summary FROM authenticated';
    -- Allow only service_role for backend/admin use via edge functions or server context
    EXECUTE 'GRANT SELECT ON public.invitation_security_summary TO service_role';

    -- Add a helpful comment
    PERFORM 1; -- no-op to keep block valid
  END IF;
END $$;

-- Optional: Document intent
COMMENT ON VIEW public.invitation_security_summary IS 'Admin-only summary of client invitations; access restricted to service_role when implemented as a view. For tables, RLS enforces admin-only SELECT.';