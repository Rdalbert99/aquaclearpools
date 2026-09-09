# Aqua Clear Roadmap

## In progress
- **Monthly executive summary email** — build `send-monthly-executive-summary` edge function
  (Mailjet), schedule it on the last day of each month, log sends in
  `commercial_monthly_report_sends`, add a manual "send now" for admins.
- **HCC portal users** — admin UI on Commercial Accounts page to link users (role, facility,
  monthly-report flag). HCC contact names/emails still needed from Randy to complete linking.
- **Service dashboard** — new `/service-dashboard` (admin + techs): scheduled visits,
  upcoming visits, tech calendar wired to the new service workflow.
- **Publish + re-scrape** — publish so logo/favicon/social previews go live on
  getaquaclear.com, then re-scrape the URL to confirm.
- **Messaging health check** — outbound SMS confirmed working; inbound replies and delivery
  receipts are blocked because the `TELNYX_PUBLIC_KEY` secret is missing (webhooks rejected as
  unsigned). Needs the key added, then Telnyx portal webhook URLs verified.

## Done
- **Tech-first service workflow redesign** (sticky header + health score, collapsible cards,
  visit actions with auto-logging, algaecide scheduling, follow-up prompt + dashboard,
  structured visit snapshots).

- Dark-mode logo variant applied across app + email templates.
