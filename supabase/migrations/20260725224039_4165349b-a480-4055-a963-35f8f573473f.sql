-- 1) inbound_sms_messages: explicit service-role-only insert, block others
DROP POLICY IF EXISTS "Service role can insert inbound sms" ON public.inbound_sms_messages;
CREATE POLICY "Service role can insert inbound sms"
ON public.inbound_sms_messages
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "No client inserts to inbound sms" ON public.inbound_sms_messages;
CREATE POLICY "No client inserts to inbound sms"
ON public.inbound_sms_messages
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

-- 2) salt_cell_alert_log: service-role writes only
DROP POLICY IF EXISTS "Service role can insert salt cell alerts" ON public.salt_cell_alert_log;
CREATE POLICY "Service role can insert salt cell alerts"
ON public.salt_cell_alert_log
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "No client inserts to salt cell alert log" ON public.salt_cell_alert_log;
CREATE POLICY "No client inserts to salt cell alert log"
ON public.salt_cell_alert_log
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

GRANT ALL ON public.inbound_sms_messages TO service_role;
GRANT ALL ON public.salt_cell_alert_log TO service_role;

-- 3) Storage: ownership-aware read access for photos and pool-images
CREATE OR REPLACE FUNCTION public.can_read_client_media(object_path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  first_segment text;
  candidate_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF public.get_current_user_role() IN ('admin', 'tech') THEN
    RETURN true;
  END IF;

  first_segment := split_part(object_path, '/', 1);
  BEGIN
    candidate_id := first_segment::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  RETURN EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = candidate_id AND c.user_id = auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_read_client_media(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_client_media(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_read_client_media(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated users can view photos" ON storage.objects;
CREATE POLICY "Staff and owning clients can view photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'photos' AND public.can_read_client_media(name));

DROP POLICY IF EXISTS "Authenticated users can view pool images" ON storage.objects;
CREATE POLICY "Staff and owning clients can view pool images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'pool-images' AND public.can_read_client_media(name));