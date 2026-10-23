CREATE TABLE public.qbo_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id text NOT NULL UNIQUE,
  company_name text,
  environment text NOT NULL DEFAULT 'production',
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  access_expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz,
  connected_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.qbo_connections TO service_role;
REVOKE ALL ON public.qbo_connections FROM anon, authenticated;
ALTER TABLE public.qbo_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access to QBO tokens" ON public.qbo_connections
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER update_qbo_connections_updated_at BEFORE UPDATE ON public.qbo_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.qbo_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL,
  return_url text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.qbo_oauth_states TO service_role;
REVOKE ALL ON public.qbo_oauth_states FROM anon, authenticated;
ALTER TABLE public.qbo_oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access to QBO oauth states" ON public.qbo_oauth_states
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);