# Aqua Clear Roadmap

## In progress
- **Messaging health check** — outbound SMS confirmed working; inbound replies and delivery
  receipts are blocked because the `TELNYX_PUBLIC_KEY` secret is missing (webhooks rejected as
  unsigned). Needs the key added, then Telnyx portal webhook URLs verified.

## Requested (not started)
- **Tech-first service workflow redesign**
  - Sticky header: customer name, status, assigned tech, live timer, 0–100 color-coded pool health score.
  - Collapsible cards: Today's Service, Chemistry, Equipment, Checklist, Photos & Notes,
    Repairs & Estimates, Billing (placeholder).
  - Today's Service actions: "On my way" text, Start Service, Complete Service, with automatic
    timestamp logging, status changes, and locked tech assignment.
  - Chemistry: scheduled algaecide maintenance dosing by pool volume + per-customer schedule.
  - Complete Service prompts for follow-up date + reason, auto-creates that visit, and surfaces
    it on a follow-up dashboard.
  - Visit history stored in structured form for future AI analysis and cross-customer trends.

## Done
- Dark-mode logo variant applied across app + email templates.
