CREATE POLICY "Commercial portal users view follow ups"
ON public.follow_up_visits
FOR SELECT
TO authenticated
USING (public.commercial_can_view_client(client_id));