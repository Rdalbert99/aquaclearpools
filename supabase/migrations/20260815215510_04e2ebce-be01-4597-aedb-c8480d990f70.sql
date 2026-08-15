-- 1) Restrict internal purchase (supplier invoice) data to admins only.
DROP POLICY IF EXISTS "Admin/tech read inventory purchases" ON public.chemical_inventory_purchases;
CREATE POLICY "Admins read inventory purchases"
  ON public.chemical_inventory_purchases FOR SELECT TO authenticated
  USING (get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin/tech write inventory purchases" ON public.chemical_inventory_purchases;
CREATE POLICY "Admins insert inventory purchases"
  ON public.chemical_inventory_purchases FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

-- 2) Scope service chemical usage to the tech who owns the service.
DROP POLICY IF EXISTS "Admin/tech read service chemical usage" ON public.service_chemical_usage;
CREATE POLICY "Read own service chemical usage"
  ON public.service_chemical_usage FOR SELECT TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.services s
      JOIN public.clients c ON c.id = s.client_id
      WHERE s.id = service_chemical_usage.service_id
        AND (s.technician_id = auth.uid()
             OR c.assigned_technician_id = auth.uid()
             OR c.secondary_technician_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admin/tech insert service chemical usage" ON public.service_chemical_usage;
CREATE POLICY "Insert own service chemical usage"
  ON public.service_chemical_usage FOR INSERT TO authenticated
  WITH CHECK (
    get_current_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.services s
      JOIN public.clients c ON c.id = s.client_id
      WHERE s.id = service_chemical_usage.service_id
        AND (s.technician_id = auth.uid()
             OR c.assigned_technician_id = auth.uid()
             OR c.secondary_technician_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admin/tech update service chemical usage" ON public.service_chemical_usage;
CREATE POLICY "Update own service chemical usage"
  ON public.service_chemical_usage FOR UPDATE TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = service_chemical_usage.service_id AND s.technician_id = auth.uid()
    )
  )
  WITH CHECK (
    get_current_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = service_chemical_usage.service_id AND s.technician_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin/tech delete service chemical usage" ON public.service_chemical_usage;
CREATE POLICY "Delete own service chemical usage"
  ON public.service_chemical_usage FOR DELETE TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = service_chemical_usage.service_id AND s.technician_id = auth.uid()
    )
  );

-- 3) Base costs: keep tech read (needed for on-site cost preview) but block writes to admins only.
DROP POLICY IF EXISTS "Techs can view chemical base costs" ON public.chemical_base_costs;
CREATE POLICY "Staff view chemical base costs"
  ON public.chemical_base_costs FOR SELECT TO authenticated
  USING (get_current_user_role() = ANY (ARRAY['admin','tech']));

REVOKE ALL ON public.chemical_inventory_purchases FROM anon;
REVOKE ALL ON public.service_chemical_usage FROM anon;
REVOKE ALL ON public.chemical_base_costs FROM anon;