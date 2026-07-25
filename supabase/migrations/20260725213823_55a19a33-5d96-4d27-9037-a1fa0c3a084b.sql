ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS secondary_technician_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_secondary_technician_id ON public.clients (secondary_technician_id);

DROP POLICY IF EXISTS clients_select_02_assigned_tech_only ON public.clients;
CREATE POLICY clients_select_02_assigned_tech_only
ON public.clients
FOR SELECT
TO authenticated
USING (
  get_current_user_role() = 'tech'
  AND (assigned_technician_id = auth.uid() OR secondary_technician_id = auth.uid())
  AND status::text = 'Active'
);

DROP POLICY IF EXISTS clients_update_02_assigned_tech_limited ON public.clients;
CREATE POLICY clients_update_02_assigned_tech_limited
ON public.clients
FOR UPDATE
TO authenticated
USING (
  get_current_user_role() = 'tech'
  AND (assigned_technician_id = auth.uid() OR secondary_technician_id = auth.uid())
)
WITH CHECK (
  get_current_user_role() = 'tech'
  AND (assigned_technician_id = auth.uid() OR secondary_technician_id = auth.uid())
);