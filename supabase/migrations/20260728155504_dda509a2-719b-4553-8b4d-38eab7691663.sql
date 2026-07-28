CREATE TABLE public.message_send_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,
  client_name text,
  technician_id uuid,
  technician_name text,
  source text not null default 'review_and_send',
  channel text not null,
  recipient text,
  message text,
  status text not null,
  error_detail text,
  provider_message_id text,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT ON public.message_send_logs TO authenticated;
GRANT ALL ON public.message_send_logs TO service_role;

ALTER TABLE public.message_send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can insert message send logs"
ON public.message_send_logs FOR INSERT TO authenticated
WITH CHECK (public.get_current_user_role() IN ('admin','tech') AND technician_id = auth.uid());

CREATE POLICY "Admins can view all message send logs"
ON public.message_send_logs FOR SELECT TO authenticated
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Techs can view their own message send logs"
ON public.message_send_logs FOR SELECT TO authenticated
USING (technician_id = auth.uid());

CREATE INDEX idx_message_send_logs_created_at ON public.message_send_logs (created_at DESC);
CREATE INDEX idx_message_send_logs_client ON public.message_send_logs (client_id);