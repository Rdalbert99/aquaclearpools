# Roadmap

## In progress
- [ ] Telnyx public key: secure form was dismissed — inbound texts/delivery receipts still reject until TELNYX_PUBLIC_KEY value is saved (user must paste it from the Telnyx portal)
- [ ] HCC portal users: link Hattiesburg Country Club management via Admin → Commercial → Portal Users (needs their names/emails / existing Aqua Clear logins); HCC has no service visits yet, so their dashboard will populate after the first logged service

## Done
- Monthly executive summary: function deployed, cron active (last day of month, America/Chicago), manual test returned 200 (HCC skipped — no opted-in recipients yet); auto-sends to org billing email + opted-in portal users
- Portal Users admin panel: grant access, role, monthly-report/alert toggles, "Send summary now", send history
- Service Dashboard at /service-dashboard (admin + tech): month calendar, day detail, next-14-days, per-tech workload; nav links added
- Typecheck clean; site published — getaquaclear.com live with Aqua Clear title/OG/social image (verified by re-fetch)
