import { supabase } from '@/integrations/supabase/client';
import { endpointEnrollmentAdapter } from './billing-enrollment';
// Bound to real authenticated SDK transport. A missing endpoint is an error, never local success.
// No calls at module import; isolated tests inject their own transport.
export async function billingInvoke<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('billing-orchestrator', { body });
  if (error || data?.error) throw new Error(data?.error ?? 'Billing not saved — backend deployment/setup pending');
  if (!data || typeof data !== 'object') throw new Error('Billing response unavailable');
  return data as T;
}
export const authenticatedEnrollmentAdapter = endpointEnrollmentAdapter(body => billingInvoke(body));