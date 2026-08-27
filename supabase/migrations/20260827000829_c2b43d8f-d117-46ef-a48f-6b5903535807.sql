ALTER TABLE public.commercial_organizations
  ADD COLUMN IF NOT EXISTS primary_contact_name text,
  ADD COLUMN IF NOT EXISTS billing_notes text;

ALTER TABLE public.pools
  ADD COLUMN IF NOT EXISTS sanitizer_type text,
  ADD COLUMN IF NOT EXISTS service_frequency text,
  ADD COLUMN IF NOT EXISTS season_start date,
  ADD COLUMN IF NOT EXISTS season_end date;