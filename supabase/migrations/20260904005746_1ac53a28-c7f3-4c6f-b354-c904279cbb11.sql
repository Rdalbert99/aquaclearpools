-- 1. Visit lifecycle on services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS started_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS on_my_way_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS technician_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS equipment_check jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS visit_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS health_score integer;

-- 2. Algaecide schedule on clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS algaecide_interval_days integer,
  ADD COLUMN IF NOT EXISTS algaecide_product text,
  ADD COLUMN IF NOT EXISTS algaecide_last_dosed date;

-- 3. Service status events (append-only visit log)
CREATE TABLE IF NOT EXISTS public.service_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES public.services(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  technician_id uuid,
  technician_name text,
  event_type text NOT NULL,
  detail text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.service_status_events TO authenticated;
GRANT ALL ON public.service_status_events TO service_role;

ALTER TABLE public.service_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view service status events"
  ON public.service_status_events FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "Staff can add service status events"
  ON public.service_status_events FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() AND auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_service_status_events_service ON public.service_status_events(service_id);
CREATE INDEX IF NOT EXISTS idx_service_status_events_client ON public.service_status_events(client_id, created_at DESC);

-- 4. Follow-up visits
CREATE TABLE IF NOT EXISTS public.follow_up_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source_service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL,
  reason text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'open',
  assigned_technician_id uuid,
  created_by uuid,
  completed_service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_up_visits TO authenticated;
GRANT ALL ON public.follow_up_visits TO service_role;

ALTER TABLE public.follow_up_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all follow ups"
  ON public.follow_up_visits FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Techs view follow ups for their clients"
  ON public.follow_up_visits FOR SELECT TO authenticated
  USING (
    public.is_staff() AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = follow_up_visits.client_id
        AND (c.assigned_technician_id = auth.uid() OR c.secondary_technician_id = auth.uid())
    )
  );

CREATE POLICY "Techs create follow ups for their clients"
  ON public.follow_up_visits FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff() AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = follow_up_visits.client_id
        AND (c.assigned_technician_id = auth.uid() OR c.secondary_technician_id = auth.uid())
    )
  );

CREATE POLICY "Techs update follow ups for their clients"
  ON public.follow_up_visits FOR UPDATE TO authenticated
  USING (
    public.is_staff() AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = follow_up_visits.client_id
        AND (c.assigned_technician_id = auth.uid() OR c.secondary_technician_id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_staff() AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = follow_up_visits.client_id
        AND (c.assigned_technician_id = auth.uid() OR c.secondary_technician_id = auth.uid())
    )
  );

CREATE POLICY "Clients view their own follow ups"
  ON public.follow_up_visits FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = follow_up_visits.client_id AND c.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_follow_up_visits_date ON public.follow_up_visits(scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_follow_up_visits_client ON public.follow_up_visits(client_id);

CREATE TRIGGER update_follow_up_visits_updated_at
  BEFORE UPDATE ON public.follow_up_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();