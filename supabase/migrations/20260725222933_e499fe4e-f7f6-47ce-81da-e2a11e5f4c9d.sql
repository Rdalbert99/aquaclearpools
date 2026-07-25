-- 1) Photos bucket: remove public read, allow authenticated users only
DROP POLICY IF EXISTS "Public can view photos" ON storage.objects;

CREATE POLICY "Authenticated users can view photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'photos');

-- 2) Reviews: clients cannot self-approve their reviews
DROP POLICY IF EXISTS "Clients can create their own reviews" ON public.reviews;

CREATE POLICY "Clients can create their own reviews"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  client_id IN (SELECT clients.id FROM public.clients WHERE clients.user_id = auth.uid())
  AND COALESCE(status, 'pending') = 'pending'
  AND approved_at IS NULL
  AND approved_by IS NULL
);

-- Defense in depth: force pending status on any non-admin insert
CREATE OR REPLACE FUNCTION public.enforce_review_pending_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_current_user_role() IS DISTINCT FROM 'admin' THEN
    NEW.status := 'pending';
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_enforce_pending_status ON public.reviews;
CREATE TRIGGER reviews_enforce_pending_status
BEFORE INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.enforce_review_pending_status();