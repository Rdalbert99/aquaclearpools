# Billing completion assessment — October 25, 2026

## Production unchanged

Source/test work only. No publication, function deployment, remote SQL, customer writes,
invoices, messages, charges, refunds, credentials or live permissions changed. Existing
production mode and flags were not queried or changed. All tests used synthetic local
PostgreSQL or mocked HTTP. Baseline: `7a7b642997624e2d96a371111acf8236154b4101`.
Lovable manages saved source commits; no commit was manually created.

## Concrete implementation, not pending callbacks

- `server/production.ts` and `entrypoint.ts`: runnable Supabase SDK factory/host with JWT
  `getUser`, protected active admin + owner/admin membership, fixed host scope, real RPC
  gateway, real-schema source authority, enrollment read/save, scoped customer creation,
  authoritative preview, immutable approval, execution/resume, mapping/setup verification,
  run history, invoice/delivery reconciliation and exact-ID payment readback.
- Browser uses authenticated SDK transport `billing-orchestrator`, not a permanently
  pending adapter. Missing unpublished endpoint remains a visible failure; no local save.
- Customer routes `/admin/clients/new`, `/admin/clients/:id/edit`, `/admin/clients/:id`.
  Admin create uses scoped server creation before a separate actual-ID enrollment save.
  **Do not publish this frontend ahead of that endpoint**: ordinary admin create now
  depends on verified scoped creation. Technician creation is unchanged and never enrolls.
- `/admin/invoice-delivery` loads saved authority/balances, approves the same fingerprint,
  displays fresh approved totals and provider reconciliation; no enabled send button.
- SQL proposals revalidate current real rate/status/contact/consent provenance/STOP,
  mapping, annual/provider config and enrollment on approval/create/channel/resume.
  Missing-row STOP is protected by short deterministic table locks. These locks serialize
  source transactions globally; bounded roster reads avoid a large concurrent lock queue.
  A database transaction cannot prevent STOP arriving after commit but before provider
  acceptance: durable dispatch authorization plus immediate final guard is the boundary.
- QBO reads check customer/item/income account and conservative US non-taxable setup;
  writes use one persisted request ID, exact coverage/item/tax/charge validation and no
  blind retries. Manual/paid relevant invoices are blocked for review, not duplicated.
- Telnyx single validated recipient and Mailjet exact recipient with no BCC; messages
  separate new invoice, previous open balances and verified official payment URL.
  Durable dispatch intent precedes sending; provider IDs/outcomes persist separately.
  `sent` means provider acceptance, not guaranteed inbox/carrier delivery.
- Reconciliation requires independently fetched invoice/run marker or recipient/provider
  message evidence, including content hash or correlation when outcome persistence failed.
  Unknown/no proof is never automatically resent. Mailjet IDs are parsed losslessly.
- Separate invoice/announcement scheduler actions and durable announcement claims exist;
  morning hour, approved scope/text, flags and registration remain unapproved/off.
- Exact 33-ID cohort at `2026-10-25T12:32:45Z` is frozen in source and unapplied SQL.
  Laken stays off/held; Peggy's confirmed $3,000 November annual is seeded only in the
  unapplied proposal; Shelby/Jennifer remain unknown and blocked. No live seed occurred.

## Needs customer/company configuration

- Exact existing QBO links verified in business/environment/realm; no customer auto-create.
- Reviewed service item/income account and US non-taxable treatment. Other tax modes are
  intentionally blocked, not treated as implemented/verified company behavior.
- Auditable SMS consent provenance, valid single phone/email and STOP handling.
- Official InvoiceLink capability and reviewed hostname policy; missing link blocks delivery.
- Shelby/Jennifer renewal/amount confirmations; no guessed dates or monthly ×12.
- Announcement morning hour, scope ID/text and recipient snapshot approvals.

## Needs deployment / privilege approval

Apply only after separate approval, in order: `UNAPPLIED-schema.sql`,
`UNAPPLIED-source-guards.sql`, then `UNAPPLIED-bootstrap.sql` with reviewed actor.
`DEPLOYMENT.txt` describes the host and named endpoint. No automatic deployment artifacts
were placed under `supabase/functions` or `supabase/migrations`.

Proposed privileges: `service_role ALL` on new `qbo_billing_*` orchestration/config/evidence
tables; RLS enabled with **no anon/authenticated policies or grants**. Scoped RPCs are
service-only; revoke PUBLIC/anon/authenticated execution. Internal unscoped claim/channel/
approval helpers have service execution revoked. Existing roles/auth/grants are untouched.
Service key stays inside host; caller JWT or scheduler secret is never the service key.
The service-only gateway is a trusted boundary: privileged RPC inputs cannot be exposed as
arbitrary browser RPC calls. Administrative functions additionally recheck protected membership.

Existing secret references: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, publishable/anon key,
environment-specific existing QBO keys, TELNYX_API_KEY, MAILJET_API_KEY/SECRET.
Scheduler needs separately reviewed BILLING_SCHEDULER_SECRET and host business/realm config.
No secret values were inspected, logged, installed or placed in SQL.

## Still unimplemented / not fully proven

- Executable cron registration with secure secret delivery is not supplied: the scheduler
  invocation proposal is deliberately non-executable until host/secret registration review.
- Source changes do not provide a billing-specific signed webhook ingestion service;
  terminal delivery evidence is operator readback. Telnyx readback is limited to 10 days;
  older missing proof remains reconciliation-required, not failure or permission to resend.
- There is no automatic provider search/replay for a create timeout without an invoice ID;
  operator supplies a candidate ID and exact persisted run marker must verify it. Safe
  request-ID replay and manual-invoice adoption are not enabled.
- Cross-worker QBO refresh uses optimistic persisted CAS plus in-process coalescing, not
  a database lease held over Intuit refresh; simultaneous refresh conflict fails closed.
- Full authenticated SDK/PostgREST happy-path and rendered customer save/read/approval
  integration, every scheduler/announcement state, and real provider contract acceptance
  have not been proven. Do not call this operational or ready to send before release checks.
- Customer scoped-create currently lacks a persisted create idempotency key coordinated
  with earlier account creation; response-loss recovery must be reviewed before publication.

## Checks actually run

- `bun run test`: 264 tests / 24 files passed, isolated/mocked.
- `bun docs/billing-readiness/tests/local-postgres.ts`: 18 actual PostgreSQL contracts passed:
  real source/JSON roundtrip, approval, unauthorized/cross-realm, stale rate/new STOP,
  concurrent first STOP insertion, enrollment off/stale toggle, two simultaneous claims,
  channel CAS, null outcome, unknown resume rejection, invalid evidence, retained provider
  ID, off-on duplicate lock, annual/later-month overlap and send-day rejection.
- Initial `/usr/bin/initdb` failed: `$libdir/dict_snowball` missing. Supported PostgreSQL
  17.9 Nix package initialized successfully under `/tmp/billing-pg`, loopback port 55439.
  No production URL, secrets or remote database used. Fixture/seed/runner stay in source.
- Focused ESLint over server/test source, billing transport/enrollment, AutomaticInvoicing,
  InvoiceDelivery and production tests passed.
- `bun run lint`: existing repository-wide failure, 476 errors and 61 warnings (537).
- Automatic platform build/typecheck: latest checked entry `build OK`; no manual builds
  or typechecks run because platform instructions delegate them to automatic checks.

Changed groups: `docs/billing-readiness/server/{production,entrypoint,providers,source}.ts`,
existing workflow/bootstrap, SQL proposals/deployment/test docs; frontend enrollment/
transport/control/NewClient/InvoiceDelivery; production contract tests; AGENTS/roadmap.
Earlier README first/second-pass blockers are historical; this assessment supersedes them.