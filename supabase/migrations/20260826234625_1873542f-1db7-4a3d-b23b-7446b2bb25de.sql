-- =========================================================
-- COMMERCIAL LAYER (purely additive)
-- =========================================================

-- ---------- ENUMS ----------
DO $$ BEGIN
  CREATE TYPE public.commercial_status AS ENUM ('normal','monitor','attention_needed','action_required');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.equipment_issue_status AS ENUM ('new','monitoring','warranty_contacted','service_scheduled','waiting_on_parts','repair_in_progress','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.commercial_user_role AS ENUM ('viewer','manager');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- TABLES
-- =========================================================

CREATE TABLE public.commercial_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  billing_email text,
  phone text,
  address text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commercial_organizations TO authenticated;
GRANT ALL ON public.commercial_organizations TO service_role;
ALTER TABLE public.commercial_organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.commercial_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  city text,
  state text,
  zip_code text,
  contact_name text,
  contact_phone text,
  contact_email text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_facilities_org ON public.facilities(organization_id);
GRANT SELECT ON public.facilities TO authenticated;
GRANT ALL ON public.facilities TO service_role;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

-- Commercial pool: bridges a facility to an EXISTING clients record.
CREATE TABLE public.pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  name text NOT NULL,
  pool_use text,
  pool_type text,
  pool_size integer,
  status public.commercial_status NOT NULL DEFAULT 'normal',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pools_facility ON public.pools(facility_id);
CREATE INDEX idx_pools_client ON public.pools(client_id);
GRANT SELECT ON public.pools TO authenticated;
GRANT ALL ON public.pools TO service_role;
ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.commercial_org_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.commercial_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE,
  role public.commercial_user_role NOT NULL DEFAULT 'viewer',
  title text,
  receives_monthly_report boolean NOT NULL DEFAULT true,
  receives_urgent_alerts boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, facility_id)
);
CREATE INDEX idx_cou_user ON public.commercial_org_users(user_id);
GRANT SELECT ON public.commercial_org_users TO authenticated;
GRANT ALL ON public.commercial_org_users TO service_role;
ALTER TABLE public.commercial_org_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.pool_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  pool_id uuid REFERENCES public.pools(id) ON DELETE SET NULL,
  name text NOT NULL,
  category text,
  manufacturer text,
  model text,
  serial_number text,
  installation_date date,
  warranty_expiration date,
  status public.commercial_status NOT NULL DEFAULT 'normal',
  photo_urls text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_equipment_facility ON public.pool_equipment(facility_id);
GRANT SELECT ON public.pool_equipment TO authenticated;
GRANT ALL ON public.pool_equipment TO service_role;
ALTER TABLE public.pool_equipment ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.equipment_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  pool_id uuid REFERENCES public.pools(id) ON DELETE SET NULL,
  equipment_id uuid REFERENCES public.pool_equipment(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  severity public.commercial_status NOT NULL DEFAULT 'monitor',
  status public.equipment_issue_status NOT NULL DEFAULT 'new',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  warranty_claim_reference text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_issues_facility ON public.equipment_issues(facility_id);
CREATE INDEX idx_issues_status ON public.equipment_issues(status);
GRANT SELECT ON public.equipment_issues TO authenticated;
GRANT INSERT, UPDATE ON public.equipment_issues TO authenticated;
GRANT ALL ON public.equipment_issues TO service_role;
ALTER TABLE public.equipment_issues ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.equipment_issue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.equipment_issues(id) ON DELETE CASCADE,
  status public.equipment_issue_status,
  note text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_issue_events_issue ON public.equipment_issue_events(issue_id);
GRANT SELECT ON public.equipment_issue_events TO authenticated;
GRANT INSERT ON public.equipment_issue_events TO authenticated;
GRANT ALL ON public.equipment_issue_events TO service_role;
ALTER TABLE public.equipment_issue_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.facility_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text,
  file_path text,
  external_url text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_docs_facility ON public.facility_documents(facility_id);
GRANT SELECT ON public.facility_documents TO authenticated;
GRANT ALL ON public.facility_documents TO service_role;
ALTER TABLE public.facility_documents ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- ACCESS HELPERS (SECURITY DEFINER -> no RLS recursion)
-- =========================================================

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT public.get_current_user_role() IN ('admin','tech');
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT public.get_current_user_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.commercial_can_view_org(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.commercial_org_users cou
    WHERE cou.user_id = auth.uid() AND cou.organization_id = p_org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.commercial_can_view_facility(p_facility_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.commercial_org_users cou
    JOIN public.facilities f ON f.organization_id = cou.organization_id
    WHERE cou.user_id = auth.uid()
      AND f.id = p_facility_id
      AND (cou.facility_id IS NULL OR cou.facility_id = f.id)
  );
$$;

-- Does the signed-in commercial user own this residential/commercial client record?
CREATE OR REPLACE FUNCTION public.commercial_can_view_client(p_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pools p
    JOIN public.facilities f ON f.id = p.facility_id
    JOIN public.commercial_org_users cou ON cou.organization_id = f.organization_id
    WHERE p.client_id = p_client_id
      AND cou.user_id = auth.uid()
      AND (cou.facility_id IS NULL OR cou.facility_id = f.id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.commercial_can_view_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.commercial_can_view_facility(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.commercial_can_view_client(uuid) TO authenticated;

-- =========================================================
-- RLS POLICIES  (anon is never granted anything here)
-- =========================================================

-- Organizations
CREATE POLICY "admin_all_orgs" ON public.commercial_organizations FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "staff_read_orgs" ON public.commercial_organizations FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY "members_read_own_org" ON public.commercial_organizations FOR SELECT TO authenticated
  USING (public.commercial_can_view_org(id));

-- Facilities
CREATE POLICY "admin_all_facilities" ON public.facilities FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "staff_read_facilities" ON public.facilities FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY "members_read_own_facilities" ON public.facilities FOR SELECT TO authenticated
  USING (public.commercial_can_view_facility(id));

-- Pools
CREATE POLICY "admin_all_pools" ON public.pools FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "staff_read_pools" ON public.pools FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY "members_read_own_pools" ON public.pools FOR SELECT TO authenticated
  USING (public.commercial_can_view_facility(facility_id));

-- Org users (membership)
CREATE POLICY "admin_all_org_users" ON public.commercial_org_users FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "self_read_membership" ON public.commercial_org_users FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Equipment
CREATE POLICY "admin_all_equipment" ON public.pool_equipment FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "staff_read_equipment" ON public.pool_equipment FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY "members_read_own_equipment" ON public.pool_equipment FOR SELECT TO authenticated
  USING (public.commercial_can_view_facility(facility_id));

-- Issues: admins full, techs may log/update, members read-only
CREATE POLICY "admin_all_issues" ON public.equipment_issues FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "staff_read_issues" ON public.equipment_issues FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY "staff_insert_issues" ON public.equipment_issues FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());
CREATE POLICY "staff_update_issues" ON public.equipment_issues FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "members_read_own_issues" ON public.equipment_issues FOR SELECT TO authenticated
  USING (public.commercial_can_view_facility(facility_id));

-- Issue history
CREATE POLICY "admin_all_issue_events" ON public.equipment_issue_events FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "staff_read_issue_events" ON public.equipment_issue_events FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY "staff_insert_issue_events" ON public.equipment_issue_events FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());
CREATE POLICY "members_read_own_issue_events" ON public.equipment_issue_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.equipment_issues i
    WHERE i.id = issue_id AND public.commercial_can_view_facility(i.facility_id)
  ));

-- Documents
CREATE POLICY "admin_all_documents" ON public.facility_documents FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "staff_read_documents" ON public.facility_documents FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY "members_read_own_documents" ON public.facility_documents FOR SELECT TO authenticated
  USING (public.commercial_can_view_facility(facility_id));

-- =========================================================
-- ADDITIVE read access on EXISTING tables for commercial members
-- (no existing policy is altered or dropped)
-- =========================================================

CREATE POLICY "commercial_members_read_their_clients" ON public.clients FOR SELECT TO authenticated
  USING (public.commercial_can_view_client(id));

CREATE POLICY "commercial_members_read_their_services" ON public.services FOR SELECT TO authenticated
  USING (public.commercial_can_view_client(client_id));

CREATE POLICY "commercial_members_read_their_chem_usage" ON public.service_chemical_usage FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = service_id AND public.commercial_can_view_client(s.client_id)
  ));

-- =========================================================
-- TRIGGERS: updated_at + issue history
-- =========================================================
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.commercial_organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_facilities_updated BEFORE UPDATE ON public.facilities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pools_updated BEFORE UPDATE ON public.pools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cou_updated BEFORE UPDATE ON public.commercial_org_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_equipment_updated BEFORE UPDATE ON public.pool_equipment
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_issues_updated BEFORE UPDATE ON public.equipment_issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_docs_updated BEFORE UPDATE ON public.facility_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.log_equipment_issue_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.equipment_issue_events (issue_id, status, note, actor_id)
    VALUES (NEW.id, NEW.status, 'Issue opened', auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.equipment_issue_events (issue_id, status, note, actor_id)
    VALUES (NEW.id, NEW.status, 'Status changed to ' || NEW.status::text, auth.uid());
    IF NEW.status = 'completed' AND NEW.closed_at IS NULL THEN
      UPDATE public.equipment_issues SET closed_at = now() WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_issue_history AFTER INSERT OR UPDATE ON public.equipment_issues
  FOR EACH ROW EXECUTE FUNCTION public.log_equipment_issue_change();