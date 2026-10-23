CREATE TABLE public.client_qbo_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment IN ('sandbox','production')),
  qbo_customer_id text NOT NULL CHECK (qbo_customer_id ~ '^[0-9]{1,20}$'),
  qbo_display_name text,
  linked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, environment),
  UNIQUE (environment, qbo_customer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_qbo_links TO authenticated;
GRANT ALL ON public.client_qbo_links TO service_role;
ALTER TABLE public.client_qbo_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No anon access to qbo links" ON public.client_qbo_links AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Admins manage qbo links" ON public.client_qbo_links FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE TRIGGER trg_client_qbo_links_updated BEFORE UPDATE ON public.client_qbo_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();