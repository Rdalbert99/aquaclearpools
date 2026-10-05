DROP POLICY IF EXISTS "Authenticated can read notification templates" ON public.notification_templates;

CREATE POLICY "Admins can read notification templates"
  ON public.notification_templates
  FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() = 'admin');