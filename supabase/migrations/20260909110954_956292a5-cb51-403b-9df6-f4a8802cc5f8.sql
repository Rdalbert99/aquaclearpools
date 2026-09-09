CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.commercial_monthly_report_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.commercial_organizations(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  recipients text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'sent',
  error_detail text,
  triggered_by text NOT NULL DEFAULT 'cron',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS commercial_monthly_report_sends_unique
  ON public.commercial_monthly_report_sends (facility_id, period_key)
  WHERE status = 'sent';

GRANT SELECT ON public.commercial_monthly_report_sends TO authenticated;
GRANT ALL ON public.commercial_monthly_report_sends TO service_role;

ALTER TABLE public.commercial_monthly_report_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view monthly report sends"
  ON public.commercial_monthly_report_sends
  FOR SELECT TO authenticated
  USING (public.is_admin_user());