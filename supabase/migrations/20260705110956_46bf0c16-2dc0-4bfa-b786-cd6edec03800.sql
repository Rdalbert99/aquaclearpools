
CREATE TABLE IF NOT EXISTS public.notification_templates (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  sms_body TEXT,
  email_subject TEXT,
  email_text TEXT,
  email_html TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read notification templates"
  ON public.notification_templates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert notification templates"
  ON public.notification_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can update notification templates"
  ON public.notification_templates
  FOR UPDATE
  TO authenticated
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete notification templates"
  ON public.notification_templates
  FOR DELETE
  TO authenticated
  USING (public.get_current_user_role() = 'admin');

CREATE TRIGGER trg_notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.notification_templates (key, label, description, sms_body, email_subject, email_text, email_html)
VALUES (
  'salt_cell_cleaned',
  'Salt Cell Cleaned',
  'Sent to the customer when their salt cell has been cleaned. Placeholders: {first_name}, {customer}, {cleaned_date}, {business_name}.',
  'Aqua Clear Pools: Hi {first_name}, your salt cell was cleaned on {cleaned_date} and is back in service. Thanks for choosing us! Reply STOP to opt out.',
  'Your salt cell has been cleaned',
  E'Hi {first_name},\n\nJust a quick note to let you know your salt cell was cleaned on {cleaned_date} and is back in service. Regular cleanings keep your cell producing chlorine efficiently and extend its lifespan.\n\nIf you have any questions, just reply to this email or give us a call.\n\nThanks for choosing {business_name}!',
  '<p>Hi {first_name},</p><p>Just a quick note to let you know your salt cell was cleaned on <strong>{cleaned_date}</strong> and is back in service. Regular cleanings keep your cell producing chlorine efficiently and extend its lifespan.</p><p>If you have any questions, just reply to this email or give us a call.</p><p>Thanks for choosing <strong>{business_name}</strong>!</p>'
)
ON CONFLICT (key) DO NOTHING;
