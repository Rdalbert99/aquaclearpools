# Consolidated billing readiness — prepared October 25, 2026

## Safety / production state

This change is source-only. No frontend publication, function deployment, remote SQL,
customer/accounting mutation, invoice, SMS/email, payment, schedule registration,
credential change, or integration provisioning was performed. Production billing_mode=off
is preserved; it was not queried or changed. The user-provided backend inventory is the
baseline, not a remotely reverified finding. No live end-to-end requests were made.

Server code is intentionally kept under `docs/billing-readiness/server`, NOT
`supabase/functions`. SQL is `UNAPPLIED-schema.sql`, NOT a managed migration. Existing
qbo-connect stays read-only, and no existing permissions/auth/RLS are changed. New-table
service-only grants in the SQL are review proposals, not applied permission changes.

## Prepared behavior

- Active normalization includes `Active`, ` active ` and `ACTIVE`; excludes inactive /
  suspended. Client roster reads all pages, not a case-sensitive status query.
- Send month is separate from next service month / first-of-month due date. Oct 26,
  noon Chicago = 17:00 UTC sends November service due Nov 1. Nov 30 noon = 18:00 UTC
  sends December; December rolls into January. Calendar initialization uses Chicago.
- Laken's stable client ID and exact-name restrictive fallback impose OWNER HOLD, not
  a rate-pending diagnosis; her existing $125 metadata is untouched.
- Peggy's stable ID carries November annual renewal, Nov 1 2026–Oct 31 2027 coverage,
  existing $3,000 text-only proposal. Amount remains a review gate, never monthly ×12.
  Shelby/Jennifer remain prepaid exclusions with unknown renewal/amount review gates.
  Unknown/ambiguous annual identity cannot become a monthly bill.
- Missing mapping, amount, tax/item/account or consented channel remains in the roster
  with blockers. Old debt remains separate presentation, never a new invoice line.
- Save/approval effects removed from the readiness UI pending verified server storage.
  No stale stored approval can masquerade as fresh; approved total is zero until
  authoritative approvals are available. Displayed totals are explicitly proposals.
- Server workflow takes only an approval ID, authenticates protected admin or scheduler,
  checks scoped activation, immutable fingerprint and authoritative current proposal,
  then atomic unique claim. Annual/monthly share a slot, and draft SQL serializes all
  coverage periods for a customer to prevent annual overlap with later monthly bills.
- Before creation, reconcile all relevant QBO invoices (paid/manual included), block
  ambiguous matches, verify customer/item/income account and tax setup, read balances.
  Provider creation uses stable requestid and NO automatic write retries. A durable
  in-flight marker precedes creation; crashes/timeouts stop for reconciliation.
- Per-channel CAS persists sending before delivery; sent/unknown/sending are not
  automatically resent. Definitively failed delivery can resume on the same invoice
  only with a single-worker resume claim and fresh authorization/consent checks.
- Separate invoice/announcement flags default false; unresolved morning hour is null.
  Last-Monday due work may catch up later that same Chicago day, using durable unique
  enqueue/claims. A missed entire day is an operator review, not a next-day mass send.

## Explicit activation blockers / incomplete integration bindings

These are not hidden behind success messages. This is NOT operational invoicing yet.

1. Review and test `UNAPPLIED-schema.sql` against an isolated disposable database, then
   obtain separate approval for the managed migration. SQL has not been executed or
   integration-tested. It creates ONLY service-owned orchestration records, not a
   parallel official invoice ledger. No customer/rate/config seeds are included.
2. Implement and verify concrete transactional Store/Authority bindings against the
   actual schema. `saveReviewedApproval` must lock/recompute source data and synchronize
   canonical config/revision/fingerprint atomically; direct browser rates never enter
   storage. Every mapping needs business+environment+realm scope and provider verification.
   Existing legacy client_qbo_links cannot establish realm verification by themselves.
3. The draft SQL provides immutable approval/audit records, atomic creation/channel
   claims and overlap locks. Production state-update/resume/reconciliation adapters and
   their privileged audited RPC contracts still require isolated database verification.
   A stuck claim is NEVER automatically released after a timeout; known provider IDs
   and delivery outcomes need explicit authorized reconciliation.
4. `serverAuthenticator` needs existing protected role/membership resolver and validated
   JWT getUser; scheduler needs a separately stored dedicated secret. No new role storage
   or permissions are provisioned. Concrete bindings are deliberately not deployed.
5. Confirm each annual client's month and annual amount. Peggy's month is confirmed;
   her amount is existing reviewable source, not saved confirmed annual configuration.
   Laken hold release needs separate owner instruction.
6. Confirm exact QBO customer mapping, ItemRef / active income account and company-specific
   tax behavior. `qboReadAdapter` requires a real tax verifier; no default pass. Inclusive /
   exclusive taxation needs isolated QBO contract checks; unexpected TotalAmt blocks.
   Create response validates provider ID/customer/due/total; coverage is derived from
   the approved request and is independently checked on subsequent reads via text.
   Never auto-create customers or guess service item / payment URLs.
7. QBO email write adapter is prepared. Telnyx SMS delivery, official invoice/payment URL
   lookup and message composition with fresh QBO balance remain mandatory explicit
   bindings; there is no default provider or fabricated successful delivery.
8. Independently verify consent provenance: UI preserves the EXISTING service-text opt-in
   logic from notification_method, not new consent. The server authority must require
   auditable invoice/service consent and fresh STOP checks; a mere channel preference
   without proven opt-in must not authorize SMS.
9. Approve announcement text/scope AND morning hour separately; recipients resolved on
   the server, including owner holds, with durable per-channel claims. Both flags remain
   off. No cron is registered. Registration/deployment needs separate approval, correct
   secure target and same-day catch-up monitoring; no invented approved hour.
10. Finish isolated integration verification before approving publication, server
    deployment, billing activation and schedule registration. The $5 test receipt is
    not proof of this workflow. No real customer/provider integration was tested here.

## Checks

- `bun run test`: 235 tests passed across 20 files (mocked/local only).
- `bun run lint`: FAILED, 476 errors / 61 warnings across repository (537 total);
  existing broad `any` and require/style issues. No whole-repository lint cleanup was
  attempted because it is outside the approved scope.
- `bunx eslint src/lib/billing-readiness.ts src/lib/invoice-delivery.ts src/pages/admin/InvoiceDelivery.tsx src/lib/__tests__/billing-*.test.ts src/lib/__tests__/invoice-delivery.test.ts docs/billing-readiness/server/*.ts`: passed.
- Build/typecheck: platform automatic checks in `/tmp/observability/build-errors.log`;
  initial fixture-type errors were corrected, latest result is build OK. No manual
  build/typecheck command was run because repository execution rules delegate these
  checks to the platform; no additional tool/package installation or paid integration.
- SQL: source review only, not applied. Browser/live/end-to-end: not run by request.

Changed paths: `src/lib/billing-readiness.ts`, `src/lib/invoice-delivery.ts`,
`src/pages/admin/InvoiceDelivery.tsx`, `src/pages/admin/Billing.tsx`, three new
`src/lib/__tests__/billing-*.test.ts`, existing invoice-delivery tests,
`docs/billing-readiness/{README.md,UNAPPLIED-schema.sql,server/*.ts}`, `AGENTS.md`,
`roadmap.md`, and project invoice-rollout memory. Baseline source commit:
`68dd7f93b8fd2ed5f172e2519187447be4584e87`; source commits are managed by Lovable.
