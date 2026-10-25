import { datesForServiceMonth, defaultEnrollment, parseMonth, type Enrollment } from './billing-readiness';
export interface EnrollmentScope { businessId: string; environment: 'sandbox' | 'production'; realmId: string; clientId: string }
export interface EnrollmentAdapter {
  ready: boolean;
  load(scope: EnrollmentScope): Promise<Enrollment | null>;
  save(scope: EnrollmentScope, input: { enabled: boolean; firstServicePeriod: string | null; expectedRevision: number }): Promise<Enrollment>;
}
// Explicit fail-closed binding, no network and no localStorage. Inject a verified endpoint
// adapter only after schema/deployment activation; controls never pretend to persist.
export const pendingEnrollmentAdapter: EnrollmentAdapter = {
  ready: false, load: async () => { throw new Error('Enrollment not saved — backend setup pending'); },
  save: async () => { throw new Error('Not saved — backend setup pending'); },
};
export async function saveEnrollment(adapter: EnrollmentAdapter, scope: EnrollmentScope | null, input: { enabled: boolean; firstServicePeriod: string | null; expectedRevision: number }) {
  if (!adapter.ready || !scope?.businessId || !scope.realmId || !scope.clientId) throw new Error('Not saved — backend setup pending');
  if (input.enabled) parseMonth(input.firstServicePeriod ?? '');
  const saved = await adapter.save(scope, input);
  if (saved.revision <= input.expectedRevision || saved.enabled !== input.enabled || saved.firstServicePeriod !== input.firstServicePeriod || !saved.updatedBy || !saved.updatedAt) throw new Error('Not saved — authoritative readback mismatch');
  return saved;
}
export function firstMonthLabel(period: string) {
  const d = datesForServiceMonth(period);
  const label = new Date(`${d.serviceStart}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `${label} service — sent ${d.sendDay} at noon Chicago; due ${d.dueDate}`;
}
export { defaultEnrollment };
/** Prepared transport binding: caller injects a VERIFIED deployed endpoint; none is active. */
export function endpointEnrollmentAdapter(invoke: (body: Record<string, unknown>) => Promise<{ enrollment?: Enrollment | null; error?: string }>): EnrollmentAdapter {
  return {
    ready: true,
    load: async scope => {
      const result = await invoke({ action: 'read_enrollment', clientId: scope.clientId });
      if (result.error || !('enrollment' in result)) throw new Error(result.error ?? 'Enrollment unavailable');
      return result.enrollment ?? null;
    },
    save: async (scope, input) => {
      const result = await invoke({ action: 'save_enrollment', clientId: scope.clientId, ...input });
      if (result.error || !result.enrollment) throw new Error(result.error ?? 'Not saved');
      return result.enrollment;
    },
  };
}
