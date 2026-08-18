ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS default_tests text[] NOT NULL DEFAULT ARRAY['chlorine','alkalinity','ph','cya']::text[];

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS tests_performed text[] NOT NULL DEFAULT ARRAY[]::text[];

UPDATE public.clients
SET default_tests = ARRAY['chlorine','alkalinity','ph','cya','salt']::text[]
WHERE pool_type ILIKE '%salt%'
  AND NOT ('salt' = ANY(default_tests));