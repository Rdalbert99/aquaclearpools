CREATE TABLE public.sms_opt_outs (
  phone text PRIMARY KEY,
  client_id uuid,
  source text NOT NULL DEFAULT 'admin',
  keyword text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_opt_outs TO authenticated;
GRANT ALL ON public.sms_opt_outs TO service_role;
ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage opt-outs" ON public.sms_opt_outs FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin') WITH CHECK (public.get_current_user_role() = 'admin');

CREATE TABLE public.sms_broadcast_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  body text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_broadcast_templates TO authenticated;
GRANT ALL ON public.sms_broadcast_templates TO service_role;
ALTER TABLE public.sms_broadcast_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage broadcast templates" ON public.sms_broadcast_templates FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'admin') WITH CHECK (public.get_current_user_role() = 'admin');
CREATE TRIGGER update_sms_broadcast_templates_updated_at BEFORE UPDATE ON public.sms_broadcast_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.sms_broadcast_templates (name, body, sort_order) VALUES
('Storm Alert', 'Aqua Clear Pools: Severe weather is expected in our area. Service visits may be rescheduled for safety. Please secure loose pool items. We will follow up with any changes. Reply STOP to opt out.', 1),
('Freeze Warning', 'Aqua Clear Pools: A freeze is forecast tonight. Keep your pool pump running and do not drain the pool. Call us if your equipment shows any issues. Reply STOP to opt out.', 2),
('Service Delay', 'Aqua Clear Pools: Due to unforeseen conditions, some service visits are running behind schedule. Your pool will still be serviced; we appreciate your patience. Reply STOP to opt out.', 3),
('Holiday Schedule', 'Aqua Clear Pools: Our office will be closed for the holiday. Visits that fall on the holiday will be moved to the next business day. Happy holidays! Reply STOP to opt out.', 4);

CREATE TABLE public.sms_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by uuid NOT NULL,
  sent_by_name text,
  template_id uuid,
  template_name text,
  message text NOT NULL,
  audience text NOT NULL DEFAULT 'all_active',
  is_test boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'sending',
  intended_count integer NOT NULL DEFAULT 0,
  excluded_opt_out_count integer NOT NULL DEFAULT 0,
  excluded_invalid_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  segments integer,
  encoding text,
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT ON public.sms_broadcasts TO authenticated;
GRANT ALL ON public.sms_broadcasts TO service_role;
ALTER TABLE public.sms_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view broadcasts" ON public.sms_broadcasts FOR SELECT TO authenticated
  USING (public.get_current_user_role() = 'admin');

CREATE TABLE public.sms_broadcast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.sms_broadcasts(id) ON DELETE CASCADE,
  client_id uuid,
  client_name text,
  phone_masked text,
  status text NOT NULL,
  provider_message_id text,
  error_code text,
  error_detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sms_broadcast_recipients_broadcast ON public.sms_broadcast_recipients(broadcast_id);
GRANT SELECT ON public.sms_broadcast_recipients TO authenticated;
GRANT ALL ON public.sms_broadcast_recipients TO service_role;
ALTER TABLE public.sms_broadcast_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view broadcast recipients" ON public.sms_broadcast_recipients FOR SELECT TO authenticated
  USING (public.get_current_user_role() = 'admin');