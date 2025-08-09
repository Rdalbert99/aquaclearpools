-- Allow admins to delete service requests
DROP POLICY IF EXISTS "Admins can delete service requests" ON public.service_requests;
CREATE POLICY "Admins can delete service requests"
ON public.service_requests
FOR DELETE
USING (get_current_user_role() = 'admin');