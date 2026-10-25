# Consolidated billing readiness — prepared October 25, 2026

**Current third-pass assessment:** see [COMPLETION.md](./COMPLETION.md). The sections below
record earlier source passes and their historical blockers; they are not the current binding inventory.

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
  owner-confirmed $3,000 text-only annual amount (Oct 25, 12:09 UTC), superseding historical $2,750; never monthly ×12.
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
5. Peggy's $3,000 annual amount and November renewal are now owner-confirmed in SOURCE only. Confirm each other annual client's month and amount; no live annual configuration was written.
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

- `bun run test`: 255 tests passed across 23 files (mocked/local only).
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


## Second consolidated pass — customer enrollment

Baseline: `051d0f4e2062abc7559d28ce0cf1565a616e56f4`.

**Customer routes:** `/admin/clients/new` (draft/default OFF),
`/admin/clients/:id/edit` (Automatic invoicing + First billing month),
`/admin/clients/:id` (read-only summary and edit link). Readiness links these controls
at `/admin/invoice-delivery`. Controls have real draft interactions and fail-closed save
handling, but the deployed-backend adapter is NOT bound: they state **not saved / backend
setup pending**, never claim production enrollment. Nothing is stored in localStorage
or inserted into the existing client create/edit payload. Enrollment is a separate
server-owned configuration, independent of service Active/season/channel/autopay.

First billing month means service month. November 2026 sends Oct 26 noon Chicago, due
Nov 1. New customers default OFF. Existing eligible Active customers are intended ON from
November except Laken OFF, via `server/bootstrap.ts` frozen cohort manifest only. The
full stable-ID cohort/as-of capture was unavailable without prohibited live access;
manifest remains empty/unapproved with known owner ID overrides, not runtime blanket-on.
No bootstrap SQL is executed. Later enrollment choices must not be overwritten.

### Concrete source prepared (NOT deployed or SQL-tested)

- Shared `Enrollment` enabled/first period/revision/actor/time participates in proposal
  eligibility and immutable snapshots, so all approval/execution/retry checks invalidate
  when changed. Missing enrollment fails closed. Disabling never voids existing QBO IDs.
- `enrollmentService` validates inputs, admin authorization, server-resolved realm/business,
  membership, hold and missed-send-day rules; persistence errors propagate.
- `supabase-bindings.ts` concretely maps scoped enrollment read/save, approval/run read,
  claim/channel/update/resume/config synchronization to parameterized RPC contracts.
- `endpoint.ts` validates Request/Response actions, allowed origins, auth, disabled setup,
  enrollment read/save and invoice execution; resume has a separate optional binding and
  fails closed if unavailable. No entrypoint or default network dependencies exist.
- SQL draft now includes separate enrollment, frozen membership/hold, enrollment audit,
  read/save/sync functions, scoped run/channel/resume/update wrappers. Enrollment save and
  invoice/channel/resume checks share per-client advisory lock, compare exact authoritative
  enrollment JSON/revision, invalidate queued config atomically, retain provider IDs.
  Channel guards revalidate saved config; workflow rechecks current consent/STOP immediately
  after channel claim before send. Creation is permitted only on due send day after noon.
- Strict state transitions disallow unknown/in-flight resets; separate resume claim cannot
  reclaim sending/unknown. Outcomes can still be recorded after disable without authorizing
  a new effect. Reconciliation remains a restricted audited operator implementation blocker.
- `enrolled-queue.ts` recomputes saved approval eligibility and rejects an entirely missed
  send day; scheduler enqueue does not enroll anybody or backfill past months.

### Exact pending activation binding / remaining gaps

1. Review and test the entire unapplied SQL in a disposable database. No SQL was executed;
   mock tests do NOT prove actual Postgres serialization. Review JSON timestamp roundtrips,
   transition/lock ordering, role authorization and every RPC contract before applying.
2. Bind `AutomaticInvoicing` to `endpointEnrollmentAdapter` only after verified deployment,
   passing stable server-established business/environment/realm/client scope. Create a
   client first; then save separate enrollment with actual ID. Customer save does not save
   draft enrollment until this binding exists. Readiness must load that same saved enrollment.
3. Bind `RpcGateway` to server-only Supabase SDK and protected auth/membership resolver.
   Concrete `source()` and transactional source-data/config recomputation are still missing:
   current rates/status, verified realm mapping, provider settings and auditable consent/STOP
   must be read from the actual schema and synchronized without preflight-only races.
   SQL enrollment is guarded atomically; other mutable source records still require actual
   source-row locking/revalidation adapter and isolated database tests. Do not mark ready.
4. Frozen cohort needs full reviewed IDs/as-of and scope rows; future customer scope records
   must default enrollment OFF. No blanket Active query/auto-enrollment is permitted.
5. Owner hold remains enforced by stable identity and restrictive fallback. No release
   endpoint is supplied; a deliberate separately approved audited release is required.
6. SMS/payment-link/provider tax and connection bindings, secure scheduler secret,
   resume/reconciliation operator review, isolated integration proof and all activation /
   publication/deployment approvals remain pending as in first pass. All flags remain OFF.

### Second pass checks

`bun run test`: 255 tests / 23 files passed, all local/mocked.
Focused command:
`bunx eslint src/lib/billing-readiness.ts src/lib/billing-enrollment.ts src/components/billing/AutomaticInvoicing.tsx src/pages/admin/InvoiceDelivery.tsx src/lib/__tests__/billing-*.test.ts docs/billing-readiness/server/*.ts`
passed. Existing customer page files retain pre-existing lint issues; entire
`bun run lint` remains 476 errors / 61 warnings (537 total). Automatic platform
build/typecheck was checked after edits; no manual build/typecheck command or live test.

Second-pass paths: `src/lib/billing-{readiness,enrollment}.ts`,
`src/components/billing/AutomaticInvoicing.tsx`, `src/pages/admin/{NewClient,ClientEdit,ClientView,InvoiceDelivery}.tsx`,
billing test files, `docs/billing-readiness/server/{enrollment,bootstrap,endpoint,supabase-bindings,enrolled-queue,transitions,workflow}.ts`,
`docs/billing-readiness/{README.md,UNAPPLIED-schema.sql}`, `AGENTS.md`, `roadmap.md` and invoice memory.
Production remains unchanged, not operational enrollment/invoicing.
