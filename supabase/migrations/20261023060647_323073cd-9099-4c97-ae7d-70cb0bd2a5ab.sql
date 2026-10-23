ALTER TABLE public.qbo_connections ADD COLUMN IF NOT EXISTS needs_reconnect boolean NOT NULL DEFAULT false;

CREATE TABLE public.qbo_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  endpoint text,
  http_status integer,
  error_code text,
  message text NOT NULL,
  intuit_tid text,
  attempts integer NOT NULL DEFAULT 1,
  user_id uuid
);
GRANT SELECT ON public.qbo_error_logs TO authenticated;
GRANT ALL ON public.qbo_error_logs TO service_role;
ALTER TABLE public.qbo_error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No anon access to QBO error logs" ON public.qbo_error_logs AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Admins read QBO error logs" ON public.qbo_error_logs FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE INDEX qbo_error_logs_created_idx ON public.qbo_error_logs (created_at DESC);