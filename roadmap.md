# Roadmap

## In progress
- [x] Grouped final billing corrections from b5d887a: retry attempts, announcement channel/STOP, explicit reviewed tax, real-role isolation, durable customer create, fresh UI approvals/policy, executable inactive schedule template and final isolated verification (283 unit/rendered tests, 49 isolated SQL/provider/SDK/template contracts). Live activation remains blocked by separate deployment/config/provider proof approval.
- [x] Third billing source wiring: authenticated transport/factory/host, real-schema atomic source guards, provider/evidence adapters, frozen 33-customer unapplied bootstrap and 18 isolated PostgreSQL contracts. Production unchanged; remaining release/config/verification gates in docs/billing-readiness/COMPLETION.md.
- [x] Second billing source pass: unsaved customer enrollment/first service month controls, confirmed Peggy annual, atomic enrollment SQL guards and concrete RPC/endpoint source adapters, frozen unapproved cohort contract; 255 mocked tests pass. No live effects.
- [ ] Enrollment activation — BLOCKED: reviewed SQL/privileges and server deployment, scoped-create release coordination, provider/company configuration and full isolated HTTP/UI integration verification. Exact frozen cohort and initial PostgreSQL proof now prepared; no live activation approved.
- [x] Consolidated billing readiness source preparation (Oct 25 2026): roster, next-month dates, annual review, guarded mocked QBO workflow, durable claim SQL and disabled schedule source prepared; 235 tests pass.
- [ ] Consolidated billing activation — BLOCKED: reviewed unapplied schema, concrete transactional/provider/authorization bindings, confirmed annual and tax/mapping setup, isolated integration verification and separate deployment/activation approvals. See docs/billing-readiness/README.md; no live effects permitted.
- [ ] QuickBooks read-only test (/admin/quickbooks): built; waiting on Intuit app keys QBO_CLIENT_ID + QBO_CLIENT_SECRET and redirect URI registration, then admin connects and tests invoice #350154860. Full QBO billing plan (preferences, prepaid discount, promo note) drafted, not built
- [ ] getaquaclear.app: checked available ($9.99 first year, renews $14.80/yr) — user deferred the purchase to later; when bought, connect it and set primary so getaquaclear.com redirects
- [ ] Billing & accounting system: plan approved (plan only). Waiting on: processor choice, invoice style, tech cash/check, QuickBooks exports + subscription cost. Phase 1 foundation BUILT in preview (billing off, admin-only /admin/billing). Next: Phase 2 QuickBooks import (needs exports + subscription cost); payment provider = check Lovable built-in (must be enabled from Lovable editor chat)
- [ ] Provider-neutral AI command layer: analysis drafted (Actions API core, MCP later needs Lovable Cloud or outside hosting); awaiting go-ahead

- [ ] Telnyx public key: secure form was dismissed — inbound texts/delivery receipts still reject until TELNYX_PUBLIC_KEY value is saved (user must paste it from the Telnyx portal)
- [ ] HCC portal users: link Hattiesburg Country Club management via Admin → Commercial → Portal Users (needs their names/emails / existing Aqua Clear logins); HCC has no service visits yet, so their dashboard will populate after the first logged service

## Done
- Website speed pass (preview only, not published): compressed photos/logo/banner, staff pages load on demand, quieter install tip, branded Page not found, reviews month/year. Mobile Lighthouse 88 on test build.
- Chemistry Lab: controlled test-kit rack in technician visits, admin customer details, customer portal and calculator. Exact numeric input, shared pool targets, expanded advice, read-only history; 49 tests pass and isolated desktop/mobile browser checks pass. Authenticated end-to-end and real iPhone/PWA checks unavailable; no publish or messages.
- Refresh app button (top bar, account menu, mobile menu, Settings): checks for a newly published version and swaps to it; falls back to a plain reload where no service worker runs. APP_VERSION bumped to 1.1.0 + release notes entry. Typecheck clean, 16 tests pass, build OK, preview loads clean; on-site click-through not verified (external Supabase, no sign-in available to me)
- Customer Broadcast SMS (/admin/broadcast): built, not yet used for a real send; awaiting admin test-send + publish
- In-Season / Off-Season scheduling (customer edit, calendars, tech schedule, status; billing untouched)
- Monthly executive summary: function deployed, cron active (last day of month, America/Chicago), manual test returned 200 (HCC skipped — no opted-in recipients yet); auto-sends to org billing email + opted-in portal users
- Portal Users admin panel: grant access, role, monthly-report/alert toggles, "Send summary now", send history
- Service Dashboard at /service-dashboard (admin + tech): month calendar, day detail, next-14-days, per-tech workload; nav links added
- Typecheck clean; site published — getaquaclear.com live with Aqua Clear title/OG/social image (verified by re-fetch)
- [x] Voice entry on service visit screen (not published)

- [x] QuickBooks sign-in/error-handling compliance batch
- [x] QuickBooks sandbox/live separation (preview backend)
- [ ] QuickBooks live connection — waiting on: live keys added in Secrets + switch approval
- [ ] QuickBooks sandbox end-to-end test — blocked: Intuit sandbox app keys not added
- [ ] Resend Karen Crago portal invitation — BLOCKED: no email on her customer record

## Invoice delivery rollout (Mon Oct 26 2026)
- [x] Invoice Text/Email/Both preferences, admin overrides, audit, approval screen, announcement preview (sending off)
- [ ] Monday announcement send — blocked: send function not built/enabled; needs user approval of preview + test send
- [ ] Monday noon Chicago invoices for next month's service, due the first — blocked: billing activation and provider verification not approved; Laken Ford Ramey remains on explicit owner hold (preserve $125 rate). Live connection health is not rechecked in this source-only task.
- [x] Outstanding balances: read-only QuickBooks open invoices by linked customer ID, shown separately from the new invoice + account total in admin review, portal and message drafts (preview only)
- [ ] Link each customer to their QuickBooks customer ID (Invoice Delivery → Link QuickBooks) — waiting on: working live QuickBooks connection (last live attempt rejected the keys)
- [x] App auto-update on iPhone: fresh pages online, safe update when nothing unsaved, visit drafts, version label (preview only, not published)
- [x] Existing-customer recognition on Create Account (verified email → links one matching customer; ambiguous → admin review) — preview only
- [ ] Customer signup confirmation emails — BLOCKED: Supabase Auth SMTP login rejected (535); fix SMTP credentials in Supabase dashboard
- [ ] Publish decision (Oct 25): hold until delta SQL is installed and billing server artifact redeployed with setup actions.
