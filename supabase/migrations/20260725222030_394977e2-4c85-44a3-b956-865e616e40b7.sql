DROP POLICY IF EXISTS "Pool images are publicly accessible" ON storage.objects;

CREATE POLICY "Authenticated users can view pool images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'pool-images');