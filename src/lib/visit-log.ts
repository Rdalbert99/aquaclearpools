// Append-only visit event logging + the structured visit snapshot used for
// future AI analysis and cross-customer trend reporting.

import { supabase } from '@/integrations/supabase/client';

export type VisitEventType =
  | 'on_my_way'
  | 'started'
  | 'completed'
  | 'completed_no_notify'
  | 'follow_up_created'
  | 'assignment_locked';

export interface VisitEventInput {
  serviceId?: string | null;
  clientId: string;
  technicianId?: string | null;
  technicianName?: string | null;
  eventType: VisitEventType;
  detail?: string | null;
}

/** Best-effort: never block the tech's workflow on a logging failure. */
export async function logVisitEvent(input: VisitEventInput): Promise<void> {
  try {
    await supabase.from('service_status_events').insert({
      service_id: input.serviceId ?? null,
      client_id: input.clientId,
      technician_id: input.technicianId ?? null,
      technician_name: input.technicianName ?? null,
      event_type: input.eventType,
      detail: input.detail ?? null,
    });
  } catch (err) {
    console.error('Visit event log failed:', err);
  }
}

export interface VisitSnapshotInput {
  clientId: string;
  clientName: string;
  poolSize?: number | null;
  poolType?: string | null;
  technicianId?: string | null;
  technicianName?: string | null;
  readings: Record<string, number | null>;
  testsPerformed: string[];
  chemicals: Array<{ chemical_id: string; chemical_label: string; unit: string; quantity: number; cost: number }>;
  checklist: Record<string, boolean>;
  equipment: Record<string, unknown>;
  servicesPerformed: string[];
  healthScore: number;
  durationMinutes?: number | null;
  onMyWayAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  photos: { before?: string | null; after?: string | null };
  notes?: string | null;
  followUp?: { date: string; reason: string; notes?: string | null } | null;
  algaecide?: { due: boolean; dosedOz: number | null; product: string } | null;
}

/**
 * Versioned so future analysis code can migrate old rows safely.
 * Keep every field flat and machine-readable — no free-form blobs.
 */
export function buildVisitSnapshot(input: VisitSnapshotInput) {
  return {
    schema_version: 1,
    captured_at: new Date().toISOString(),
    client: {
      id: input.clientId,
      name: input.clientName,
      pool_size_gallons: input.poolSize ?? null,
      pool_type: input.poolType ?? null,
    },
    technician: { id: input.technicianId ?? null, name: input.technicianName ?? null },
    timeline: {
      on_my_way_at: input.onMyWayAt ?? null,
      started_at: input.startedAt ?? null,
      completed_at: input.completedAt ?? null,
      duration_minutes: input.durationMinutes ?? null,
    },
    chemistry: {
      tests_performed: input.testsPerformed,
      readings: input.readings,
      chemicals_added: input.chemicals,
      algaecide: input.algaecide ?? null,
    },
    work: {
      services_performed: input.servicesPerformed,
      checklist: input.checklist,
      equipment: input.equipment,
    },
    outcome: {
      health_score: input.healthScore,
      notes: input.notes ?? null,
      photos: input.photos,
      follow_up: input.followUp ?? null,
    },
  };
}
