# Grouped billing correction assessment — October 25, 2026

## Safety and baseline

Started from FINAL `b5d887a8c6fa42e2b55cad9035ca705ad9565e7f`, not an earlier checkpoint.
Only source edits, offline HTTP/UI mocks and disposable loopback PostgreSQL 17.9 were used.
No live requests, remote SQL, deployment/publication, customer mutations, invoices, messages,
payments, credential installation or live grant/flag/schedule changes occurred.
No spend/credit gate was presented during this pass; no gate was bypassed.
Live operational readiness is NOT established by these tests.

## Independent review corrections implemented

1. **Definitive delivery failure retries:** unique UUID attempt/correlation, row-locked reserve
   and attempt/outcome CAS. Setup is validated before reserving or HTTP. Each attempt retains
   its text hash, provider ID, proof, timestamps and audit events. Only a prior non-accepted
   explicit rejection permits another attempt. Sending/unknown/accepted attempts cannot reset.
   Persistence failure remains uncertain. Tests exercise the ACTUAL provider adapter + SQL,
   including missing setup/no HTTP, rejection then success, timeout refusal and concurrent retry.
2. **Announcements:** exact stored channel must be in immutable approved snapshot; fresh
   enrollment/consent/STOP and activation guards apply at claim and again inside final dispatch
   CAS immediately before HTTP. Missing/NULL activation fails closed. Stored text/scope/day/
   channel/snapshot/actor/time are immutable; approval cannot silently replace conflicting rows.
   Provider independently rejects channel/scope mismatches and missing STOP language. Invoice
   SMS and announcement SMS retain `Reply STOP to opt out.` Announcements remain off and the
   morning hour is unconfirmed. Post-commit STOP cannot retroactively cancel a provider request;
   final dispatch transaction is the explicit authorization linearization boundary.
3. **Tax:** US company is only a compatibility condition, never a tax attestation. Host requires
   explicit admin confirmation of `non_taxable`/`NON`; authoritative config stores actor,
   reviewedAt, revision, exact item/account. Fingerprints include the review. Missing/unconfirmed
   setup blocks readiness/payload/SQL. Taxable/inclusive/exclusive are unsupported and rejected;
   this does not determine legal tax applicability or change any live customer tax treatment.
4. **Privileges:** actual SET ROLE anon/authenticated/service_role contracts prove table denial,
   scoped API denial for public roles and internal-helper denial even for service_role. Runtime
   orchestration table privileges are removed after installation; scoped host reads replace
   direct access. Protected admin/membership checks, revoked actors and realm/client checks
   remain. Host JWT/role failures occur before scoped SQL/provider effects.
5. **Customer creation:** profile + scoped client + request record are one transaction, with
   exact frozen payload/account hash. Earlier profile no longer commits ahead of client.
   Actor-scoped on-device recovery drafts keep request/payload (NO passwords/tokens), expire
   after seven days, and recover actual ID after reload/crash. Repeat clicks are locked;
   backend missing fails before create; enrollment remains separate actual-ID save with clear
   partial failure/default OFF. Auth provisioning uses the existing separately confirmed
   invitation flow, not a password field or automatic email. Existing-user attachment requires
   reviewed same-scope ownership, never an arbitrary global user UUID. Tech create remains
   its existing path and never enrolls. Do not release this frontend before the scoped endpoint.
6. **Readiness:** fresh stored approvals load after reload and compare current fingerprint;
   server policy controls displayed mode/schedule status. Month changes/errors clear old runs/
   approvals; request sequence and scope guards reject late load/save/reconciliation results.
   No send/activation control is added. Unsaved enrollment/customer forms defer app reload.
7. **Schedule template:** real parameterized psql registration template uses only reviewed
   endpoint/Vault secret NAME references; no secret values or extension installation. Both
   jobs are registered INACTIVE in the same transaction. Missing approvals registers nothing.
   Isolated synthetic cron/net fixture verifies template executes, never invokes HTTP.

## Verification actually run

- `bun run test`: **283 tests / 26 files passed**, including **7 rendered mocked UI flows**.
- `bun docs/billing-readiness/tests/local-postgres.ts`: **18 PostgreSQL contracts passed**.
- `bun docs/billing-readiness/tests/correction-postgres.ts`: **29 additional real-role SQL,
  concurrent concrete adapter, atomic profile/client and mocked SDK/PostgREST-to-real-SQL
  contracts passed**. No live Supabase or provider acceptance was exercised.
- `bun docs/billing-readiness/tests/schedule-template.ts`: **2 executable inactive template
  contracts passed**. Total standalone isolated contracts: **49**.
- Focused ESLint command (clean):
  `bunx eslint docs/billing-readiness/server/*.ts docs/billing-readiness/tests/*.ts
  src/lib/billing-{readiness,transport,enrollment}.ts src/lib/client-create-draft.ts
  src/pages/admin/{NewClient,InvoiceDelivery}.tsx src/components/billing/AutomaticInvoicing.tsx
  src/lib/__tests__/billing*.test.{ts,tsx}`
- `bun run lint`: repository-wide **472 errors / 61 warnings** (533); unrelated pre-existing
  debt remains. Focused edited scope clean; this pass removed four customer-form any errors.
- Automatic platform build/typecheck: latest observed `build OK`; no prohibited manual
  build/typecheck was run. Exact final saved checkpoint is reported in chat after final checks.

## Needs configuration / owner confirmation (not missing code)

- Reviewed exact scoped QBO customer links, service item/income account, explicit non-taxable
  attestation (if legally appropriate), official invoice/payment-link acceptance/hostname policy.
- Auditable SMS consent and verified exact phone/email/senders; STOP always wins.
- Shelby/Jennifer annual month/amount remain blocked; Peggy confirmed $3,000 November SMS
  annual with no monthly duplicate; Laken held. Frozen exact 33-ID bootstrap remains unapplied.
- Separate announcement approved text/scope/day/recipient snapshots and morning hour.
- Reviewed scheduler secret reference, matching host secret, fixed business/environment/realm.

## Needs deployment / privileges / downstream proof

Order, only after separate owner approval:
1. Review schema and permission inventory; apply `UNAPPLIED-schema.sql` then
   `UNAPPLIED-source-guards.sql` together before exposing the endpoint.
2. Apply frozen `UNAPPLIED-bootstrap.sql` with reviewed actor and exact cohort; never runtime
   all-active enrollment. Live billing_mode stays off, all activation flags stay false.
3. Bundle/deploy reviewed `server/entrypoint.ts` + dependencies as `billing-orchestrator`;
   verify JWT, scope, read/save/approval and providers downstream in approved test context.
4. Release coordinated frontend ONLY after scoped endpoint works. Never frontend alone.
5. Apply `UNAPPLIED-schedule.sql` with explicit registration/endpoint/privilege approvals and
   reviewed endpoint/Vault NAME, ONLY if existing cron/net/Vault capability is accepted.
   Template creates two INACTIVE registrations; no job enabling is authorized here.
6. Separate operational activation/customer send approval AFTER downstream proof.

**Proposed final privileges (unapplied, exact inventory in PRIVILEGES.md):** no new direct
qbo_billing table privileges for anon/authenticated/service_role. All tables have RLS and no
public policies. Temporary installation grants are revoked before source-guards commit.
Only listed scoped functions have service_role EXECUTE; PUBLIC/anon/authenticated and
internal helpers have none. Functions remain migration-owner SECURITY DEFINER; host must
validate JWT/protected role before service gateway, never expose arbitrary RPC forwarding.
Existing users/business_members/QBO permission grants are not widened. Existing service
SDK needs its already-present users/business membership SELECT and realm-scoped connection
SELECT/UPDATE; profile/client inserts happen only inside reviewed scoped definer.
Scheduler registration is separately privileged migration-owner cron administration with
existing net.http_post and Vault read at job runtime, NOT frontend or public-role grants.

## Still unimplemented / unproven, explicitly not “ready to send”

- Billing-specific signed webhook ingestion and announcement operator evidence reconciliation
  are not supplied; uncertain announcements remain blocked without automatic retry.
- Automated provider search/replay after create timeout without an invoice ID is not supplied;
  existing operator candidate-ID evidence verifies exact run marker. No blind replay.
- Distributed QBO refresh lease is not supplied; optimistic CAS/in-process coalescing fails
  closed on cross-worker refresh conflict.
- Real Intuit/Telnyx/Mailjet contract acceptance, real PostgREST grants/cache behavior, hosted
  cron/Vault execution and production-shaped existing triggers/auth profile constraints are
  unverified. Synthetic schema/SDK mocks cannot prove these hosted behaviors.
- Full browser-to-host-to-provider end-to-end acceptance and commercial ancillary-record
  crash recovery are unproven; seven rendered local flows plus SQL/SDK contracts are not
  claimed as live acceptance. No external testing was authorized.

All seven reviewed release defects have source corrections and focused local evidence;
these residual operational/configuration/proof limits remain explicit release gates.
