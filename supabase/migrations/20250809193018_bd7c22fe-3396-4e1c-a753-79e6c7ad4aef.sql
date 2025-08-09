-- Allow admins to delete service requests
CREATE POLICY IF NOT EXISTS "Admins can delete service requests"
ON public.service_requests
FOR DELETE
USING (get_current_user_role() = 'admin');