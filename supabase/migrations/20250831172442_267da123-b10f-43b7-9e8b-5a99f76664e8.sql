-- Harden access to invitation_security_summary: admin-only
DO $$
DECLARE
  obj_kind char;
BEGIN
  SELECT c.relkind INTO obj_kind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'invitation_security_summary';

  IF obj_kind = 'r' THEN
    -- Table: use RLS
    EXECUTE 'ALTER TABLE public.invitation_security_summary ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'invitation_security_summary' 
        AND policyname = 'Admins can view invitation summary'
    ) THEN
      EXECUTE 'CREATE POLICY "Admins can view invitation summary" ' ||
              'ON public.invitation_security_summary FOR SELECT ' ||
              'USING (public.get_current_user_role() = ''admin'')';
    END IF;

    -- Do not revoke general SELECT from authenticated; RLS enforces admin-only
  ELSIF obj_kind IN ('v', 'm') THEN
    -- View or materialized view: restrict privileges to server-side only
    EXECUTE 'REVOKE ALL ON public.invitation_security_summary FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON public.invitation_security_summary FROM anon';
    EXECUTE 'REVOKE ALL ON public.invitation_security_summary FROM authenticated';
    EXECUTE 'GRANT SELECT ON public.invitation_security_summary TO service_role';
    EXECUTE 'COMMENT ON VIEW public.invitation_security_summary IS ' ||
            '''Admin-only summary; access restricted to service_role. Clients must use edge functions.''';
  END IF;
END $$ LANGUAGE plpgsql;