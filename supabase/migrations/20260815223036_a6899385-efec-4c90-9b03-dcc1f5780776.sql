DROP POLICY IF EXISTS service_requests_select_tech_assigned_clients ON public.service_requests;
CREATE POLICY service_requests_select_tech_assigned_clients
ON public.service_requests FOR SELECT TO authenticated
USING (
  public.get_current_user_role() = 'tech'
  AND client_id IN (
    SELECT c.id FROM public.clients c
    WHERE c.assigned_technician_id = auth.uid()
       OR c.secondary_technician_id = auth.uid()
  )
);

DROP POLICY IF EXISTS service_requests_update_tech_assigned_clients ON public.service_requests;
CREATE POLICY service_requests_update_tech_assigned_clients
ON public.service_requests FOR UPDATE TO authenticated
USING (
  public.get_current_user_role() = 'tech'
  AND client_id IN (
    SELECT c.id FROM public.clients c
    WHERE c.assigned_technician_id = auth.uid()
       OR c.secondary_technician_id = auth.uid()
  )
)
WITH CHECK (
  public.get_current_user_role() = 'tech'
  AND client_id IN (
    SELECT c.id FROM public.clients c
    WHERE c.assigned_technician_id = auth.uid()
       OR c.secondary_technician_id = auth.uid()
  )
);