# Roadmap

## In progress
- [ ] Monthly executive summary email: deploy send-monthly-executive-summary, verify cron job, test send (recipients: org billing email + opted-in portal users)
- [ ] Set TELNYX_PUBLIC_KEY secret (user must paste value from Telnyx portal) so inbound texts + delivery receipts land
- [ ] Service dashboard page: route + nav links added; verify rendering
- [ ] HCC portal users: link management users via new Portal Users panel (needs names/emails or existing accounts)
- [ ] Publish site so new favicon/logo/social previews go live on getaquaclear.com, then re-scrape the URL

## Done
- Tech-first service workflow (sticky header, health score, collapsible cards, follow-ups)
- Issue follow-up prompt with required equipment photo
- Dark-mode logo variant + BrandLogo switching
- PortalUsersPanel: grant access, role, monthly-report/alerts toggles, manual send, send history
- Migration: commercial_monthly_report_sends table + cron schedule send-monthly-executive-summary
- send-monthly-executive-summary edge function created (last-day auto send, America/Chicago)
