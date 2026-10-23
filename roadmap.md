# Roadmap

## In progress
- [ ] QuickBooks read-only test (/admin/quickbooks): built; waiting on Intuit app keys QBO_CLIENT_ID + QBO_CLIENT_SECRET and redirect URI registration, then admin connects and tests invoice #350154860. Full QBO billing plan (preferences, prepaid discount, promo note) drafted, not built
- [ ] getaquaclear.app: checked available ($9.99 first year, renews $14.80/yr) — user deferred the purchase to later; when bought, connect it and set primary so getaquaclear.com redirects
- [ ] Billing & accounting system: plan approved (plan only). Waiting on: processor choice, invoice style, tech cash/check, QuickBooks exports + subscription cost. Phase 1 foundation BUILT in preview (billing off, admin-only /admin/billing). Next: Phase 2 QuickBooks import (needs exports + subscription cost); payment provider = check Lovable built-in (must be enabled from Lovable editor chat)
- [ ] Provider-neutral AI command layer: analysis drafted (Actions API core, MCP later needs Lovable Cloud or outside hosting); awaiting go-ahead

- [ ] Telnyx public key: secure form was dismissed — inbound texts/delivery receipts still reject until TELNYX_PUBLIC_KEY value is saved (user must paste it from the Telnyx portal)
- [ ] HCC portal users: link Hattiesburg Country Club management via Admin → Commercial → Portal Users (needs their names/emails / existing Aqua Clear logins); HCC has no service visits yet, so their dashboard will populate after the first logged service

## Done
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
- [ ] Monday 12:00 PM CDT invoices — blocked: QuickBooks live keys rejected (invalid_client) and QBO writes not approved; Laken Ford Ramey rate pending
- [x] Outstanding balances: read-only QuickBooks open invoices by linked customer ID, shown separately from the new invoice + account total in admin review, portal and message drafts (preview only)
- [ ] Link each customer to their QuickBooks customer ID (Invoice Delivery → Link QuickBooks) — waiting on: working live QuickBooks connection (last live attempt rejected the keys)
- [x] App auto-update on iPhone: fresh pages online, safe update when nothing unsaved, visit drafts, version label (preview only, not published)
