CREATE TABLE public.client_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  changed_by_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.client_status_history TO authenticated;
GRANT ALL ON public.client_status_history TO service_role;

ALTER TABLE public.client_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view client status history"
ON public.client_status_history
FOR SELECT
TO authenticated
USING (public.get_current_user_role() IN ('admin','tech'));

CREATE INDEX idx_client_status_history_client ON public.client_status_history(client_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_client_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT u.name INTO v_name FROM public.users u WHERE u.id = auth.uid();

  INSERT INTO public.client_status_history (client_id, old_status, new_status, changed_by, changed_by_name)
  VALUES (
    NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
    COALESCE(NEW.status, 'Active'),
    auth.uid(),
    COALESCE(v_name, 'System')
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER clients_log_status_change
AFTER INSERT OR UPDATE OF status ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.log_client_status_change();