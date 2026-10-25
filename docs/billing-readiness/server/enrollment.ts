import { z } from 'zod';
import { datesForServiceMonth, chicagoDate, OWNER_IDS, type Enrollment } from '../../../src/lib/billing-readiness';
import type { EnrollmentScope } from '../../../src/lib/billing-enrollment';
import type { Actor } from './workflow';
export const EnrollmentInput = z.object({
  clientId: z.string().uuid(), enabled: z.boolean(), firstServicePeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable(),
  expectedRevision: z.number().int().nonnegative(),
}).strict();
export interface EnrollmentRepository {
  read(scope: EnrollmentScope): Promise<Enrollment | null>;
  save(scope: EnrollmentScope, input: z.infer<typeof EnrollmentInput>, actor: Actor): Promise<Enrollment>;
  clientBelongsToBusiness(scope: EnrollmentScope): Promise<boolean>;
}
export function enrollmentService(deps: {
  authenticate(credential: string): Promise<Actor | null>;
  scope(actor: Actor): Promise<Omit<EnrollmentScope, 'clientId'>>;
  repository: EnrollmentRepository;
  now(): Date;
}) {
  async function authorize(credential: string, clientId: string) {
    const actor = await deps.authenticate(credential);
    if (!actor || actor.kind !== 'admin') throw new Error('unauthorized');
    const config = await deps.scope(actor); // active realm/environment ONLY from server configuration
    if (actor.businessId !== config.businessId) throw new Error('cross_business');
    const scope = { ...config, clientId };
    if (!await deps.repository.clientBelongsToBusiness(scope)) throw new Error('cross_business');
    return { actor, scope };
  }
  return {
    async read(credential: string, clientId: string) {
      z.string().uuid().parse(clientId);
      const { scope } = await authorize(credential, clientId);
      return deps.repository.read(scope); // absent defaults OFF, never cohort enrollment at runtime
    },
    async save(credential: string, value: unknown) {
      const input = EnrollmentInput.parse(value);
      const { actor, scope } = await authorize(credential, input.clientId);
      if (input.enabled && input.clientId === OWNER_IDS.laken) throw new Error('owner_hold');
      if (input.enabled) {
        const dates = datesForServiceMonth(input.firstServicePeriod ?? '');
        // Same send day is allowed; an entirely missed day needs separate review, no backfill.
        if (dates.sendDay < chicagoDate(deps.now())) throw new Error('missed_send_day_review_required');
      }
      return deps.repository.save(scope, input, actor); // RPC repeats hold/revision/date checks atomically
    },
  };
}
