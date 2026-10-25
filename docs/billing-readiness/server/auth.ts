// No client-created actor: Supabase server validation plus protected membership lookup.
// Caller must inject an existing authorized role resolver (no auth schema changes here).
import type { Actor } from './workflow';
export function serverAuthenticator(deps: {
  getUser(jwt: string): Promise<{ id: string } | null>;
  adminBusiness(userId: string): Promise<string | null>;
  scheduler: { secret: string; businessId: string } | null;
}) {
  return async (credential: string): Promise<Actor | null> => {
    if (credential.startsWith('Bearer ')) {
      const user = await deps.getUser(credential.slice(7)); // supabase.auth.getUser(jwt), not decoded claims
      if (!user) return null;
      const businessId = await deps.adminBusiness(user.id); // protected server role / membership lookup
      return businessId ? { id: user.id, businessId, kind: 'admin' } : null;
    }
    const scheduler = deps.scheduler;
    if (!scheduler || scheduler.secret.length < 32 || !scheduler.businessId) return null;
    // Fixed-length digest comparison, avoiding an early exit on unequal credential lengths.
    const digest = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
    const [supplied, expected] = await Promise.all([digest(credential), digest(scheduler.secret)]);
    let difference = 0;
    for (let i = 0; i < expected.length; i++) difference |= supplied[i] ^ expected[i];
    return difference === 0 ? { id: 'billing-scheduler', businessId: scheduler.businessId, kind: 'scheduler' } : null;
  };
}
