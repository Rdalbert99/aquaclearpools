import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ServiceRow } from '@/lib/commercial';

export interface Membership {
  id: string;
  organization_id: string;
  facility_id: string | null;
  role: string;
  title: string | null;
}

export interface Organization {
  id: string;
  name: string;
  billing_email: string | null;
  phone: string | null;
  address: string | null;
}

export interface Facility {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
}

export interface Pool {
  id: string;
  facility_id: string;
  client_id: string | null;
  name: string;
  pool_use: string | null;
  pool_type: string | null;
  pool_size: number | null;
  status: string;
  notes: string | null;
}

export interface ClientRow {
  id: string;
  customer: string;
  pool_size: number;
  pool_type: string;
  last_service_date: string | null;
  next_service_date: string | null;
  service_days: string[] | null;
  pool_image_url: string | null;
  assigned_technician_id: string | null;
}

export interface Equipment {
  id: string;
  facility_id: string;
  pool_id: string | null;
  name: string;
  category: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  installation_date: string | null;
  warranty_expiration: string | null;
  status: string;
  photo_urls: string[];
  notes: string | null;
}

export interface Issue {
  id: string;
  facility_id: string;
  pool_id: string | null;
  equipment_id: string | null;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  warranty_claim_reference: string | null;
}

export interface IssueEvent {
  id: string;
  issue_id: string;
  status: string | null;
  note: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface ChemUsage {
  id: string;
  service_id: string;
  chemical_id: string;
  chemical_label: string;
  unit: string;
  quantity_used: number;
  line_cost: number | null;
}

export interface FacilityDocument {
  id: string;
  facility_id: string;
  title: string;
  category: string | null;
  file_path: string | null;
  external_url: string | null;
  created_at: string;
}

export interface CommercialData {
  loading: boolean;
  error: string | null;
  memberships: Membership[];
  organizations: Organization[];
  facilities: Facility[];
  pools: Pool[];
  clients: ClientRow[];
  services: ServiceRow[];
  chemUsage: ChemUsage[];
  equipment: Equipment[];
  issues: Issue[];
  issueEvents: IssueEvent[];
  documents: FacilityDocument[];
  technicianNames: Record<string, string>;
  reload: () => void;
}

/**
 * Loads everything the signed-in commercial user is allowed to see.
 * RLS does the filtering — this hook never widens access.
 */
export function useCommercialPortal(): CommercialData {
  const [state, setState] = useState<Omit<CommercialData, 'reload'>>({
    loading: true,
    error: null,
    memberships: [],
    organizations: [],
    facilities: [],
    pools: [],
    clients: [],
    services: [],
    chemUsage: [],
    equipment: [],
    issues: [],
    issueEvents: [],
    documents: [],
    technicianNames: {},
  });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const { data: memberships, error: mErr } = await supabase
          .from('commercial_org_users')
          .select('id, organization_id, facility_id, role, title');
        if (mErr) throw mErr;

        const orgIds = [...new Set((memberships ?? []).map((m) => m.organization_id))];
        if (orgIds.length === 0) {
          if (!cancelled) setState((s) => ({ ...s, loading: false, memberships: [] }));
          return;
        }

        const [orgRes, facRes] = await Promise.all([
          supabase.from('commercial_organizations').select('id, name, billing_email, phone, address').in('id', orgIds),
          supabase.from('facilities').select('*').in('organization_id', orgIds).order('name'),
        ]);
        if (orgRes.error) throw orgRes.error;
        if (facRes.error) throw facRes.error;

        const facilities = (facRes.data ?? []) as Facility[];
        const facilityIds = facilities.map((f) => f.id);
        if (facilityIds.length === 0) {
          if (!cancelled) {
            setState((s) => ({
              ...s,
              loading: false,
              memberships: memberships as Membership[],
              organizations: (orgRes.data ?? []) as Organization[],
              facilities: [],
            }));
          }
          return;
        }

        const [poolRes, eqRes, issueRes, docRes] = await Promise.all([
          supabase.from('pools').select('*').in('facility_id', facilityIds).eq('active', true).order('name'),
          supabase.from('pool_equipment').select('*').in('facility_id', facilityIds).order('name'),
          supabase.from('equipment_issues').select('*').in('facility_id', facilityIds).order('opened_at', { ascending: false }),
          supabase.from('facility_documents').select('*').in('facility_id', facilityIds).order('created_at', { ascending: false }),
        ]);
        if (poolRes.error) throw poolRes.error;

        const pools = (poolRes.data ?? []) as Pool[];
        const clientIds = pools.map((p) => p.client_id).filter((v): v is string => !!v);
        const issues = (issueRes.data ?? []) as Issue[];

        const [clientRes, serviceRes, eventRes] = await Promise.all([
          clientIds.length
            ? supabase
                .from('clients')
                .select('id, customer, pool_size, pool_type, last_service_date, next_service_date, service_days, pool_image_url, assigned_technician_id')
                .in('id', clientIds)
            : Promise.resolve({ data: [], error: null } as never),
          clientIds.length
            ? supabase
                .from('services')
                .select('id, client_id, technician_id, performed_at, service_date, status, notes, services_performed, chemicals_added, readings, actions, ph_level, chlorine_level, alkalinity_level, cyanuric_acid_level, calcium_hardness_level, tests_performed, before_photo_url, after_photo_url, duration_minutes')
                .in('client_id', clientIds)
                .order('performed_at', { ascending: false })
                .limit(1000)
            : Promise.resolve({ data: [], error: null } as never),
          issues.length
            ? supabase.from('equipment_issue_events').select('*').in('issue_id', issues.map((i) => i.id)).order('created_at')
            : Promise.resolve({ data: [], error: null } as never),
        ]);

        const services = ((serviceRes as { data: unknown[] }).data ?? []) as ServiceRow[];
        const serviceIds = services.map((s) => s.id);

        const usageRes = serviceIds.length
          ? await supabase
              .from('service_chemical_usage')
              .select('id, service_id, chemical_id, chemical_label, unit, quantity_used, line_cost')
              .in('service_id', serviceIds.slice(0, 800))
          : { data: [], error: null };

        // Technician display names — may be blocked by RLS for portal users; degrade gracefully.
        const techIds = [...new Set(services.map((s) => s.technician_id).filter((v): v is string => !!v))];
        let technicianNames: Record<string, string> = {};
        if (techIds.length) {
          const { data: techs } = await supabase.from('users').select('id, name').in('id', techIds);
          technicianNames = Object.fromEntries((techs ?? []).map((t) => [t.id, t.name]));
        }

        if (cancelled) return;
        setState({
          loading: false,
          error: null,
          memberships: (memberships ?? []) as Membership[],
          organizations: (orgRes.data ?? []) as Organization[],
          facilities,
          pools,
          clients: ((clientRes as { data: unknown[] }).data ?? []) as ClientRow[],
          services,
          chemUsage: ((usageRes as { data: unknown[] }).data ?? []) as ChemUsage[],
          equipment: (eqRes.data ?? []) as unknown as Equipment[],
          issues,
          issueEvents: ((eventRes as { data: unknown[] }).data ?? []) as IssueEvent[],
          documents: (docRes.data ?? []) as FacilityDocument[],
          technicianNames,
        });
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return useMemo(() => ({ ...state, reload }), [state, reload]);
}
