ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS service_mode text NOT NULL DEFAULT 'in_season',
  ADD COLUMN IF NOT EXISTS in_season_frequency text NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS off_season_frequency text NOT NULL DEFAULT 'twice_monthly',
  ADD COLUMN IF NOT EXISTS off_season_weeks text NOT NULL DEFAULT '1_3',
  ADD COLUMN IF NOT EXISTS off_season_start date,
  ADD COLUMN IF NOT EXISTS off_season_end date,
  ADD COLUMN IF NOT EXISTS auto_return_in_season boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.validate_client_season()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  IF NEW.service_mode NOT IN ('in_season','off_season') THEN
    RAISE EXCEPTION 'Invalid service_mode %', NEW.service_mode;
  END IF;
  IF NEW.off_season_weeks NOT IN ('1_3','2_4') THEN
    RAISE EXCEPTION 'Invalid off_season_weeks %', NEW.off_season_weeks;
  END IF;
  IF NEW.off_season_start IS NOT NULL AND NEW.off_season_end IS NOT NULL
     AND NEW.off_season_end < NEW.off_season_start THEN
    RAISE EXCEPTION 'Off-season end date must be on or after the start date';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_client_season ON public.clients;
CREATE TRIGGER trg_validate_client_season BEFORE INSERT OR UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.validate_client_season();