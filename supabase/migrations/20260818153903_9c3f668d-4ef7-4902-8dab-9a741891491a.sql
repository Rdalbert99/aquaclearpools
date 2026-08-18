ALTER TABLE public.message_send_logs
  ADD COLUMN IF NOT EXISTS track_token text,
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_status_detail text,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_open_at timestamptz,
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_open_user_agent text;

CREATE UNIQUE INDEX IF NOT EXISTS message_send_logs_track_token_key
  ON public.message_send_logs (track_token) WHERE track_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS message_send_logs_provider_message_id_idx
  ON public.message_send_logs (provider_message_id) WHERE provider_message_id IS NOT NULL;