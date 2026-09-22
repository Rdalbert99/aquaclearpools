CREATE POLICY "Staff upload inventory receipts files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inventory-receipts' AND public.is_staff());

CREATE POLICY "Staff read inventory receipts files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'inventory-receipts' AND public.is_staff());

CREATE POLICY "Admins delete inventory receipts files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'inventory-receipts' AND public.is_admin_user());