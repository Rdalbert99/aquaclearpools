// Protected-route decision. A restored session whose profile has not resolved
// yet is still "loading" — never a sign-out (fresh full-page loads / new tabs).
export type RouteGate = 'loading' | 'login' | 'allowed';
export function routeGate(s: { loading: boolean; hasSession: boolean; hasUser: boolean }): RouteGate {
  if (s.loading || (s.hasSession && !s.hasUser)) return 'loading';
  return s.hasUser ? 'allowed' : 'login';
}
