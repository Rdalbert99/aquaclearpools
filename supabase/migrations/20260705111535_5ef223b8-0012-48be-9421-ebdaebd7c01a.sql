CREATE TABLE public.sms_forwarding_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_type text NOT NULL CHECK (recipient_type IN ('assigned_tech', 'admin_user', 'tech_user', 'custom')),
  label text NOT NULL,
  user_id uuid NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone_number text NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sms_forwarding_recipient_contact CHECK (
    recipient_type = 'assigned_tech'
    OR user_id IS NOT NULL
    OR nullif(regexp_replace(coalesce(phone_number, ''), '\D', '', 'g'), '') IS NOT NULL
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_forwarding_recipients TO authenticated;
GRANT ALL ON public.sms_forwarding_recipients TO service_role;

ALTER TABLE public.sms_forwarding_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view SMS forwarding recipients"
ON public.sms_forwarding_recipients
FOR SELECT
TO authenticated
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can create SMS forwarding recipients"
ON public.sms_forwarding_recipients
FOR INSERT
TO authenticated
WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can update SMS forwarding recipients"
ON public.sms_forwarding_recipients
FOR UPDATE
TO authenticated
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete SMS forwarding recipients"
ON public.sms_forwarding_recipients
FOR DELETE
TO authenticated
USING (public.get_current_user_role() = 'admin');

CREATE TRIGGER update_sms_forwarding_recipients_updated_at
BEFORE UPDATE ON public.sms_forwarding_recipients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.inbound_sms_messages
ADD COLUMN IF NOT EXISTS forwarded_to_recipients text[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS forward_error text NULL;

INSERT INTO public.sms_forwarding_recipients (recipient_type, label, is_enabled)
VALUES ('assigned_tech', 'Assigned technician', true);