import type {
  ChemUsage,
  ClientRow,
  Equipment,
  Facility,
  FacilityDocument,
  Issue,
  IssueEvent,
  Organization,
  Pool,
} from '@/hooks/useCommercialPortal';
import type { ServiceRow } from '@/lib/commercial';

export interface PoolWithClient extends Pool {
  client: ClientRow | null;
}

/** Everything scoped to the currently selected facility. */
export interface FacilityScope {
  organization: Organization | null;
  facility: Facility;
  pools: PoolWithClient[];
  services: ServiceRow[];
  chemUsage: ChemUsage[];
  equipment: Equipment[];
  issues: Issue[];
  issueEvents: IssueEvent[];
  documents: FacilityDocument[];
  technicianNames: Record<string, string>;
}

export function technicianName(scope: FacilityScope, id: string | null): string {
  if (!id) return 'Aqua Clear technician';
  return scope.technicianNames[id] ?? 'Aqua Clear technician';
}

export function poolNameForClient(scope: FacilityScope, clientId: string | null): string {
  const pool = scope.pools.find((p) => p.client_id === clientId);
  return pool?.name ?? 'Pool';
}
