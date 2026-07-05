ALTER TABLE public.inbound_sms_messages REPLICA IDENTITY FULL;
ALTER TABLE public.pool_needs_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inbound_sms_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pool_needs_messages;