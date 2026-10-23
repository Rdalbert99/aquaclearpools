// Pure decision logic for linking a verified signup to an existing customer.
// Matching uses ONLY the auth-verified email, never client-submitted name/address.

export type LinkStatus =
  | "linked"            // linked now
  | "already_linked"    // idempotent: this user already owns a customer record
  | "no_match"          // no customer with this email; normal new account
  | "needs_review"      // ambiguous / owned by someone else -> admin review
  | "unverified"        // email not confirmed yet
  | "not_eligible";     // staff or synthetic identity

export interface LinkCandidate { id: string; user_id: string | null }

export interface LinkInput {
  email: string | null | undefined;
  emailConfirmedAt: string | null | undefined;
  profileRole: string | null | undefined;
  alreadyLinkedClientIds: string[];
  candidates: LinkCandidate[];
}

export const SYNTHETIC_DOMAIN = "@accounts.getaquaclear.com";

export function normalizeEmail(e: string | null | undefined): string {
  return (e ?? "").trim().toLowerCase();
}

export function decideLink(i: LinkInput): { status: LinkStatus; clientId?: string } {
  const email = normalizeEmail(i.email);
  if (!email || !i.emailConfirmedAt) return { status: "unverified" };
  if (email.endsWith(SYNTHETIC_DOMAIN)) return { status: "not_eligible" };
  if (i.profileRole && i.profileRole !== "client") return { status: "not_eligible" };
  if (i.alreadyLinkedClientIds.length > 0) return { status: "already_linked", clientId: i.alreadyLinkedClientIds[0] };
  if (i.candidates.length === 0) return { status: "no_match" };
  if (i.candidates.length > 1) return { status: "needs_review" };
  const c = i.candidates[0];
  if (c.user_id) return { status: "needs_review" }; // owned by another account: never take over
  return { status: "linked", clientId: c.id };
}
