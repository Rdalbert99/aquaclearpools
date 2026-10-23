import { describe, it, expect } from 'vitest';
import { decideLink } from '../../../supabase/functions/_shared/customer-link';

const base = { email: 'KarenCrago@Hotmail.com ', emailConfirmedAt: '2026-10-23T17:00:00Z', profileRole: 'client', alreadyLinkedClientIds: [] as string[], candidates: [] as { id: string; user_id: string | null }[] };

describe('existing-customer linking', () => {
  it('Karen: verified email matching one unlinked customer links it', () => {
    expect(decideLink({ ...base, candidates: [{ id: 'karen', user_id: null }] })).toEqual({ status: 'linked', clientId: 'karen' });
  });
  it('unconfirmed email never links', () => {
    expect(decideLink({ ...base, emailConfirmedAt: null, candidates: [{ id: 'karen', user_id: null }] }).status).toBe('unverified');
  });
  it('no matching customer is a normal new account', () => {
    expect(decideLink(base).status).toBe('no_match');
  });
  it('multiple customers with the same email go to admin review', () => {
    expect(decideLink({ ...base, candidates: [{ id: 'a', user_id: null }, { id: 'b', user_id: null }] }).status).toBe('needs_review');
  });
  it('customer already owned by another account is never taken over', () => {
    expect(decideLink({ ...base, candidates: [{ id: 'a', user_id: 'other' }] }).status).toBe('needs_review');
  });
  it('retries are idempotent once linked', () => {
    expect(decideLink({ ...base, alreadyLinkedClientIds: ['karen'], candidates: [] })).toEqual({ status: 'already_linked', clientId: 'karen' });
  });
  it('staff and synthetic identities are not auto-linked', () => {
    expect(decideLink({ ...base, profileRole: 'tech', candidates: [{ id: 'a', user_id: null }] }).status).toBe('not_eligible');
    expect(decideLink({ ...base, email: 'x@accounts.getaquaclear.com', candidates: [{ id: 'a', user_id: null }] }).status).toBe('not_eligible');
  });
});
