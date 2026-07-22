
-- Inventory of chemical purchases
CREATE TABLE public.chemical_inventory_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chemical_id text NOT NULL,       -- matches CHEMICAL_OPTIONS.id (e.g. 'liquid_chlorine')
  chemical_label text NOT NULL,    -- human label at time of purchase
  unit text NOT NULL,              -- 'lbs' or 'gal' (base storage unit)
  quantity numeric NOT NULL CHECK (quantity > 0),
  total_cost numeric NOT NULL CHECK (total_cost >= 0),
  unit_cost numeric GENERATED ALWAYS AS (total_cost / NULLIF(quantity, 0)) STORED,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chemical_inventory_purchases TO authenticated;
GRANT ALL ON public.chemical_inventory_purchases TO service_role;

ALTER TABLE public.chemical_inventory_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anon on inventory purchases"
  ON public.chemical_inventory_purchases FOR ALL TO anon
  USING (false) WITH CHECK (false);

CREATE POLICY "Admin/tech read inventory purchases"
  ON public.chemical_inventory_purchases FOR SELECT TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'tech'));

CREATE POLICY "Admin/tech write inventory purchases"
  ON public.chemical_inventory_purchases FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() IN ('admin', 'tech'));

CREATE POLICY "Admin update inventory purchases"
  ON public.chemical_inventory_purchases FOR UPDATE TO authenticated
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "Admin delete inventory purchases"
  ON public.chemical_inventory_purchases FOR DELETE TO authenticated
  USING (public.get_current_user_role() = 'admin');

CREATE INDEX idx_inventory_purchases_chem ON public.chemical_inventory_purchases (chemical_id, purchased_at DESC);

-- Per-service chemical usage
CREATE TABLE public.service_chemical_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  chemical_id text NOT NULL,
  chemical_label text NOT NULL,
  unit text NOT NULL,                  -- base unit: 'lbs' or 'gal'
  quantity_used numeric NOT NULL CHECK (quantity_used >= 0),
  unit_cost_snapshot numeric NOT NULL DEFAULT 0,
  line_cost numeric GENERATED ALWAYS AS (quantity_used * unit_cost_snapshot) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_chemical_usage TO authenticated;
GRANT ALL ON public.service_chemical_usage TO service_role;

ALTER TABLE public.service_chemical_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anon on service chemical usage"
  ON public.service_chemical_usage FOR ALL TO anon
  USING (false) WITH CHECK (false);

CREATE POLICY "Admin/tech read service chemical usage"
  ON public.service_chemical_usage FOR SELECT TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'tech'));

CREATE POLICY "Admin/tech insert service chemical usage"
  ON public.service_chemical_usage FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() IN ('admin', 'tech'));

CREATE POLICY "Admin/tech update service chemical usage"
  ON public.service_chemical_usage FOR UPDATE TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'tech'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'tech'));

CREATE POLICY "Admin/tech delete service chemical usage"
  ON public.service_chemical_usage FOR DELETE TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'tech'));

CREATE INDEX idx_service_chem_usage_service ON public.service_chemical_usage (service_id);

-- Cache total chemical cost per service (denormalized for graphs)
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS chemicals_cost numeric NOT NULL DEFAULT 0;
