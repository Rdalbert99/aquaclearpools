ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS preferred_contact_method text;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS current_issues text[] NOT NULL DEFAULT '{}'::text[];

-- Allow anonymous visitors to upload request photos into the intake prefix only
CREATE POLICY "Public can upload service request photos"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'service-request-photos'
  AND (storage.foldername(name))[1] = 'intake'
);

-- Only staff can read uploaded request photos
CREATE POLICY "Staff can read service request photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'service-request-photos'
  AND public.get_current_user_role() IN ('admin','tech')
);

CREATE POLICY "Admins can delete service request photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'service-request-photos'
  AND public.get_current_user_role() = 'admin'
);