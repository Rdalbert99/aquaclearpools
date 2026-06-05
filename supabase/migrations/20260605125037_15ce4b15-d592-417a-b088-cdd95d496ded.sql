CREATE TABLE public.chemical_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  units text[] NOT NULL DEFAULT ARRAY['lbs']::text[],
  purpose text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  is_other boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.chemical_catalog TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.chemical_catalog TO authenticated;
GRANT ALL ON public.chemical_catalog TO service_role;

ALTER TABLE public.chemical_catalog ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chemical_catalog FROM anon;

CREATE POLICY "Authenticated can read chemical catalog"
  ON public.chemical_catalog FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert chemical catalog"
  ON public.chemical_catalog FOR INSERT
  TO authenticated WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can update chemical catalog"
  ON public.chemical_catalog FOR UPDATE
  TO authenticated USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete chemical catalog"
  ON public.chemical_catalog FOR DELETE
  TO authenticated USING (public.get_current_user_role() = 'admin');

CREATE TRIGGER chemical_catalog_set_updated_at
  BEFORE UPDATE ON public.chemical_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults (matches src/lib/chemicals-added.ts)
INSERT INTO public.chemical_catalog (slug, label, units, purpose, sort_order, is_other) VALUES
  ('liquid_chlorine',   'Liquid Chlorine',                    ARRAY['gal','qt'],         'to sanitize the water and raise chlorine',         10, false),
  ('powder_chlorine',   'Powder Chlorine (Cal-Hypo)',         ARRAY['lbs','oz'],         'to sanitize the water and raise chlorine',         20, false),
  ('trichlor_tabs',     'Trichlor Tabs',                      ARRAY['lbs','oz'],         'for slow-release chlorination',                    30, false),
  ('shock',             'Pool Shock',                         ARRAY['lbs','oz'],         'to shock the pool and break down contaminants',    40, false),
  ('sodium_bicarb',     'Sodium Bicarbonate',                 ARRAY['lbs','oz'],         'to raise total alkalinity',                        50, false),
  ('sodium_bisulfate',  'Sodium Bisulfate (Dry Acid)',        ARRAY['lbs','oz'],         'to lower pH and total alkalinity',                 60, false),
  ('muriatic_acid',     'Muriatic Acid',                      ARRAY['gal','qt'],         'to lower pH and total alkalinity',                 70, false),
  ('soda_ash',          'Soda Ash',                           ARRAY['lbs','oz'],         'to raise pH',                                      80, false),
  ('cya',               'Cyanuric Acid (CYA / Stabilizer)',   ARRAY['lbs','oz'],         'to stabilize chlorine from sun loss',              90, false),
  ('calcium_chloride',  'Calcium Chloride',                   ARRAY['lbs','oz'],         'to raise calcium hardness',                       100, false),
  ('pool_salt',         'Pool Salt',                          ARRAY['lbs'],              'to raise salt for the chlorine generator',        110, false),
  ('ascorbic_acid',     'Ascorbic Acid',                      ARRAY['lbs','oz'],         'to remove metal stains from pool surfaces',       120, false),
  ('algaecide',         'Algaecide',                          ARRAY['oz','qt'],          'to prevent and treat algae',                      130, false),
  ('clarifier',         'Clarifier',                          ARRAY['oz','qt'],          'to clear cloudy water',                           140, false),
  ('phosphate_remover', 'Phosphate Remover',                  ARRAY['oz','qt'],          'to remove phosphates that feed algae',            150, false),
  ('other',             'Other',                              ARRAY['lbs','oz','gal','qt'], '',                                             999, true);
