-- Allow techs to see client records for services they have performed
-- This fixes "Unknown Client" in the Recent Services section
CREATE POLICY "clients_select_04_servicing_tech_history"
ON public.clients
FOR SELECT
USING (
  (get_current_user_role() = 'tech'::text)
  AND id IN (
    SELECT DISTINCT client_id FROM services WHERE technician_id = auth.uid()
  )
);