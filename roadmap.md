# Roadmap

## In progress
- [ ] Chemistry Lab: shared testing rack on technician visit, customer chemistry and calculator; synchronized inputs, pool targets, accessible mobile layout and tests. No publish or messages.
- [ ] getaquaclear.app: checked available ($9.99 first year, renews $14.80/yr) — user deferred the purchase to later; when bought, connect it and set primary so getaquaclear.com redirects
- [ ] Billing & accounting system: plan approved (plan only). Waiting on: processor choice, invoice style, tech cash/check, QuickBooks exports + subscription cost. Phase 1 foundation BUILT in preview (billing off, admin-only /admin/billing). Next: Phase 2 QuickBooks import (needs exports + subscription cost); payment provider = check Lovable built-in (must be enabled from Lovable editor chat)
- [ ] Provider-neutral AI command layer: analysis drafted (Actions API core, MCP later needs Lovable Cloud or outside hosting); awaiting go-ahead

- [ ] Telnyx public key: secure form was dismissed — inbound texts/delivery receipts still reject until TELNYX_PUBLIC_KEY value is saved (user must paste it from the Telnyx portal)
- [ ] HCC portal users: link Hattiesburg Country Club management via Admin → Commercial → Portal Users (needs their names/emails / existing Aqua Clear logins); HCC has no service visits yet, so their dashboard will populate after the first logged service

## Done
- Refresh app button (top bar, account menu, mobile menu, Settings): checks for a newly published version and swaps to it; falls back to a plain reload where no service worker runs. APP_VERSION bumped to 1.1.0 + release notes entry. Typecheck clean, 16 tests pass, build OK, preview loads clean; on-site click-through not verified (external Supabase, no sign-in available to me)
- Customer Broadcast SMS (/admin/broadcast): built, not yet used for a real send; awaiting admin test-send + publish
- In-Season / Off-Season scheduling (customer edit, calendars, tech schedule, status; billing untouched)
- Monthly executive summary: function deployed, cron active (last day of month, America/Chicago), manual test returned 200 (HCC skipped — no opted-in recipients yet); auto-sends to org billing email + opted-in portal users
- Portal Users admin panel: grant access, role, monthly-report/alert toggles, "Send summary now", send history
- Service Dashboard at /service-dashboard (admin + tech): month calendar, day detail, next-14-days, per-tech workload; nav links added
- Typecheck clean; site published — getaquaclear.com live with Aqua Clear title/OG/social image (verified by re-fetch)
- [x] Voice entry on service visit screen (not published)
