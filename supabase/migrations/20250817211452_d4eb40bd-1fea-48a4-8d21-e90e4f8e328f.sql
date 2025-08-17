-- Services: add new columns and defaults
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS performed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS readings jsonb,
  ADD COLUMN IF NOT EXISTS actions jsonb,
  ADD COLUMN IF NOT EXISTS message_preview text,
  ADD COLUMN IF NOT EXISTS duration_minutes int,
  ADD COLUMN IF NOT EXISTS before_photo_url text,
  ADD COLUMN IF NOT EXISTS after_photo_url text;

-- Ensure service_date auto-populates if not provided
ALTER TABLE public.services
  ALTER COLUMN service_date SET DEFAULT now();

-- Clients: add QuickBooks linkage fields
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS qb_invoice_link text,
  ADD COLUMN IF NOT EXISTS qb_customer_id text;

-- Create a public storage bucket for service photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the 'photos' bucket
-- Public can view photos
CREATE POLICY IF NOT EXISTS "Public can view photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'photos');

-- Admins and techs can upload photos
CREATE POLICY IF NOT EXISTS "Admins and techs can upload photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'photos'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.role IN ('admin','tech')
  )
);

-- Admins and techs can update photos
CREATE POLICY IF NOT EXISTS "Admins and techs can update photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'photos'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.role IN ('admin','tech')
  )
);

-- Admins can delete photos
CREATE POLICY IF NOT EXISTS "Admins can delete photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'photos'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.role = 'admin'
  )
);