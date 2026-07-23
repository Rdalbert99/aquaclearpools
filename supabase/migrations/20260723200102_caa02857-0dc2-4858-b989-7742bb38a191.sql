
CREATE TABLE public.chemical_base_costs (
  chemical_id text PRIMARY KEY,
  unit text NOT NULL CHECK (unit IN ('lbs','gal')),
  unit_cost numeric NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chemical_base_costs TO authenticated;
GRANT ALL ON public.chemical_base_costs TO service_role;

ALTER TABLE public.chemical_base_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage chemical base costs"
ON public.chemical_base_costs
FOR ALL
TO authenticated
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "Techs can view chemical base costs"
ON public.chemical_base_costs
FOR SELECT
TO authenticated
USING (public.get_current_user_role() IN ('admin','tech'));

CREATE TRIGGER trg_chemical_base_costs_updated_at
BEFORE UPDATE ON public.chemical_base_costs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
