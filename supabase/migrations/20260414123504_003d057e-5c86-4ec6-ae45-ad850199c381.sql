
CREATE TABLE public.inbound_sms_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_number TEXT NOT NULL,
  message_text TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT,
  technician_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  technician_name TEXT,
  forwarded_to_tech BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inbound_sms_messages ENABLE ROW LEVEL SECURITY;

-- Admins can view all inbound messages
CREATE POLICY "inbound_sms_select_admin_only"
ON public.inbound_sms_messages
FOR SELECT
TO authenticated
USING (get_current_user_role() = 'admin');

-- Admins can mark messages as read
CREATE POLICY "inbound_sms_update_admin_only"
ON public.inbound_sms_messages
FOR UPDATE
TO authenticated
USING (get_current_user_role() = 'admin');

-- Edge function (service role) inserts — allow via service role bypass
-- No authenticated insert policy needed since edge function uses service role

CREATE INDEX idx_inbound_sms_created_at ON public.inbound_sms_messages(created_at DESC);
CREATE INDEX idx_inbound_sms_client_id ON public.inbound_sms_messages(client_id);
CREATE INDEX idx_inbound_sms_read_at ON public.inbound_sms_messages(read_at);
