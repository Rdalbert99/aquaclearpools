-- Documents are stored as: <facility_id>/<filename>
CREATE POLICY "facility_docs_admin_all" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'facility-documents' AND public.is_admin_user())
WITH CHECK (bucket_id = 'facility-documents' AND public.is_admin_user());

CREATE POLICY "facility_docs_staff_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'facility-documents' AND public.is_staff());

CREATE POLICY "facility_docs_member_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'facility-documents'
  AND public.commercial_can_view_facility(NULLIF(split_part(name, '/', 1), '')::uuid)
);