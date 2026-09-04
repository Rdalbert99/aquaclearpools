# Tech-First Service Workflow Redesign

Rebuild the technician service screen so a visit runs top-to-bottom with big action buttons,
automatic logging, and structured history that can be analyzed later.

## Sticky header
Always visible while scrolling:
- Customer name + address (tap to navigate)
- Visit status chip: Scheduled -> On My Way -> In Progress -> Complete
- Assigned technician (locked once the visit starts)
- Live timer that starts on "Start Service"
- Pool Health Score 0-100, color coded (green 85+, yellow 60-84, orange 40-59, red under 40),
  computed from chemistry deviation, equipment issues, overdue service, and salt-cell status

## Collapsible cards
One accordion, opened in the order a tech works:
1. **Today's Service** - action buttons + what is included this visit
2. **Chemistry** - test entry, dosing recommendations, algaecide schedule
3. **Equipment** - pump/filter/salt cell status, flag an issue
4. **Checklist** - brushed, skimmed, baskets, filter pressure, robot cleaned / in water
5. **Photos & Notes** - before/after upload, client notes from the portal, tech notes
6. **Repairs & Estimates** - open issues, add a repair need with rough estimate
7. **Billing** - placeholder card showing visit cost and chemical cost, wired later

## Today's Service actions
- **Send "On My Way" text** - existing arrival notification with ETA
- **Start Service** - stamps `started_at`, starts the timer, locks the tech assignment
- **Complete Service** - stamps `completed_at`, saves everything, then opens the follow-up prompt
Each action writes a timestamped status event so the office sees the visit progress live.

## Chemistry: algaecide schedule
- Per-customer setting: algaecide interval (e.g. every 2 or 4 weeks) and product
- Dose computed from pool volume (oz/gal math like the existing dosage engine)
- The card flags "Algaecide due today - add X oz" and records it when the tech confirms

## Follow-up flow
On completion, a dialog asks for a follow-up date and a reason (recheck chemistry, repair,
algae treatment, equipment install, other). Saving creates the follow-up visit automatically and
it appears on a new **Follow-Ups dashboard** for admins and techs, filterable by date and reason.

## Structured visit history
Every visit is stored in a consistent, machine-readable shape: readings, doses added with
quantity and unit, checklist items completed, equipment flags, durations, photos, and outcome.
This gives clean data for later AI analysis and cross-customer trend reporting (e.g. "which
pools drift low on chlorine in August").

## Technical notes
- New DB columns/tables: visit lifecycle timestamps and status events on `services`,
  `follow_up_visits`, algaecide schedule fields on `clients`, and a structured
  `visit_snapshot` JSON column for analysis.
- New shared health-score helper in `src/lib/pool-health.ts` reusing `pool-chemistry`/`pool-status`.
- `src/pages/tech/FieldService.tsx` is rebuilt around the sticky header + accordion; existing
  logic (chemical usage, cost tracking, notifications, photo upload) is reused, not rewritten.
- New route `/follow-ups` for the follow-up dashboard.

## Build order
1. Database migration (visit lifecycle, follow-ups, algaecide schedule, snapshot)
2. Health-score helper + sticky header
3. Card-by-card rebuild of the service screen
4. Action buttons with auto-logging and assignment lock
5. Follow-up prompt + dashboard
6. Structured snapshot written on completion

## Separate item: messaging
Outbound SMS is working (recent sends all logged as `sent`). Inbound replies and delivery
receipts are dead because the `TELNYX_PUBLIC_KEY` secret is not set, so every webhook is
rejected as unsigned. Adding that key re-enables both.
