import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ServiceRow } from '@/lib/commercial';
import type {
  ChemUsage,
  ClientRow,
  Equipment,
  Facility,
  Issue,
  Organization,
  Pool,
} from '@/hooks/useCommercialPortal';

export interface FollowUpRow {
  id: string;
  client_id: string;
  scheduled_date: string;
  reason: string;
  notes: string | null;
  status: string;
  assigned_technician_id: string | null;
  photo_url: string | null;
}

export interface ExecutiveData {
  loading: boolean;
  error: string | null;
  organizations: Organization[];
  facilities: Facility[];
  pools: Pool[];
  clients: ClientRow[];
  services: ServiceRow[];
  chemUsage: ChemUsage[];
  equipment: Equipment[];
  issues: Issue[];
  followUps: FollowUpRow[];
  technicianNames: Record<string, string>;
  reload: () => void;
}

const SERVICE_COLUMNS =
  'id, client_id, technician_id, performed_at, service_date, status, notes, services_performed, chemicals_added, readings, actions, ph_level, chlorine_level, alkalinity_level, cyanuric_acid_level, calcium_hardness_level, tests_performed, before_photo_url, after_photo_url, duration_minutes';

/**
 * Admin-wide view over every commercial organization.
 * Same data shapes as the customer portal hook, but unscoped (RLS still applies).
 */
export function useCommercialExecutive(sinceDays = 180): ExecutiveData {
  const [state, setState] = useState<Omit<ExecutiveData, 'reload'>>({
    loading: true,
    error: null,
    organizations: [],
    facilities: [],
    pools: [],
    clients: [],
    services: [],
    chemUsage: [],
    equipment: [],
    issues: [],
    followUps: [],
    technicianNames: {},
  });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const since = new Date();
        since.setDate(since.getDate() - sinceDays);
        const sinceIso = since.toISOString();

        const [orgRes, facRes, poolRes] = await Promise.all([
          supabase
            .from('commercial_organizations')
            .select('id, name, billing_email, phone, address')
            .eq('active', true)
            .order('name'),
          supabase.from('facilities').select('*').eq('active', true).order('name'),
          supabase.from('pools').select('*').eq('active', true).order('name'),
        ]);
        if (orgRes.error) throw orgRes.error;
        if (facRes.error) throw facRes.error;
        if (poolRes.error) throw poolRes.error;

        const facilities = (facRes.data ?? []) as Facility[];
        const pools = (poolRes.data ?? []) as Pool[];
        const facilityIds = facilities.map((f) => f.id);
        const clientIds = [...new Set(pools.map((p) => p.client_id).filter((v): v is string => !!v))];

        const [eqRes, issueRes, clientRes, serviceRes, followRes] = await Promise.all([
          facilityIds.length
            ? supabase.from('pool_equipment').select('*').in('facility_id', facilityIds).order('name')
            : Promise.resolve({ data: [], error: null } as never),
          facilityIds.length
            ? supabase
                .from('equipment_issues')
                .select('*')
                .in('facility_id', facilityIds)
                .order('opened_at', { ascending: false })
            : Promise.resolve({ data: [], error: null } as never),
          clientIds.length
            ? supabase
                .from('clients')
                .select(
                  'id, customer, pool_size, pool_type, last_service_date, next_service_date, service_days, pool_image_url, assigned_technician_id',
                )
                .in('id', clientIds)
            : Promise.resolve({ data: [], error: null } as never),
          clientIds.length
            ? supabase
                .from('services')
                .select(SERVICE_COLUMNS)
                .in('client_id', clientIds)
                .gte('performed_at', sinceIso)
                .order('performed_at', { ascending: false })
                .limit(1000)
            : Promise.resolve({ data: [], error: null } as never),
          clientIds.length
            ? supabase
                .from('follow_up_visits')
                .select('id, client_id, scheduled_date, reason, notes, status, assigned_technician_id, photo_url')
                .in('client_id', clientIds)
                .order('scheduled_date')
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

        const techIds = [
          ...new Set(
            [
              ...services.map((s) => s.technician_id),
              ...(((followRes as { data: FollowUpRow[] }).data ?? []).map((f) => f.assigned_technician_id)),
            ].filter((v): v is string => !!v),
          ),
        ];
        let technicianNames: Record<string, string> = {};
        if (techIds.length) {
          const { data: techs } = await supabase.from('users').select('id, name').in('id', techIds);
          technicianNames = Object.fromEntries((techs ?? []).map((t) => [t.id, t.name]));
        }

        if (cancelled) return;
        setState({
          loading: false,
          error: null,
          organizations: (orgRes.data ?? []) as Organization[],
          facilities,
          pools,
          clients: ((clientRes as { data: unknown[] }).data ?? []) as ClientRow[],
          services,
          chemUsage: ((usageRes as { data: unknown[] }).data ?? []) as ChemUsage[],
          equipment: ((eqRes as { data: unknown[] }).data ?? []) as Equipment[],
          issues: ((issueRes as { data: unknown[] }).data ?? []) as Issue[],
          followUps: ((followRes as { data: unknown[] }).data ?? []) as FollowUpRow[],
          technicianNames,
        });
      } catch (err) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [tick, sinceDays]);

  return useMemo(() => ({ ...state, reload }), [state, reload]);
}
