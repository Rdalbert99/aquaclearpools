CREATE TABLE public.chemical_product_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_slug text NOT NULL,
  product_name text NOT NULL,
  manufacturer text,
  active_ingredient text,
  strength_min_pct numeric,
  strength_max_pct numeric,
  form text,
  container_size text,
  pool_suitability text NOT NULL DEFAULT 'not_verified',
  suitability_source text,
  label_notes text,
  is_preferred boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chemical_product_labels TO authenticated;
GRANT ALL ON public.chemical_product_labels TO service_role;
ALTER TABLE public.chemical_product_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read product labels" ON public.chemical_product_labels FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Admins manage product labels" ON public.chemical_product_labels FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE OR REPLACE FUNCTION public.validate_product_label()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  IF NEW.pool_suitability NOT IN ('verified','not_verified','not_suitable') THEN
    RAISE EXCEPTION 'Invalid pool suitability';
  END IF;
  IF NEW.strength_min_pct IS NOT NULL AND (NEW.strength_min_pct <= 0 OR NEW.strength_min_pct > 100) THEN
    RAISE EXCEPTION 'Strength must be between 0 and 100';
  END IF;
  IF NEW.strength_max_pct IS NOT NULL AND (NEW.strength_max_pct <= 0 OR NEW.strength_max_pct > 100) THEN
    RAISE EXCEPTION 'Strength must be between 0 and 100';
  END IF;
  IF NEW.strength_min_pct IS NOT NULL AND NEW.strength_max_pct IS NOT NULL AND NEW.strength_min_pct > NEW.strength_max_pct THEN
    RAISE EXCEPTION 'Minimum strength cannot exceed maximum';
  END IF;
  IF NEW.pool_suitability = 'verified' THEN
    IF TG_OP = 'INSERT' OR OLD.pool_suitability IS DISTINCT FROM 'verified' THEN
      NEW.verified_by := auth.uid();
      NEW.verified_at := now();
    END IF;
  ELSE
    NEW.verified_by := NULL;
    NEW.verified_at := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_product_label BEFORE INSERT OR UPDATE ON public.chemical_product_labels
FOR EACH ROW EXECUTE FUNCTION public.validate_product_label();
CREATE TRIGGER update_product_labels_updated_at BEFORE UPDATE ON public.chemical_product_labels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.chemical_product_labels (catalog_slug, product_name, manufacturer, active_ingredient, strength_min_pct, strength_max_pct, form, container_size, pool_suitability, label_notes, is_preferred)
VALUES ('calcium_chloride', 'DOWFLAKE Xtra', 'Occidental Chemical Corporation (OxyChem)', 'Calcium chloride', 83, 87, 'flake', '50 lb (22.68 kg)', 'not_verified', 'Bag says "83–87% PURE" and "not for food or drug use". Pool suitability must be confirmed with label or manufacturer.', true);