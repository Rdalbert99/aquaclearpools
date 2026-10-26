# Oct 26 billing go/no-go — live read-only findings (13:18 UTC)

## Verified in the live database
- The announcement was ALREADY SENT: 29 rows marked sent (16 email, 13 text), one per customer per channel, no duplicates. Each one has its own approved text, approver, date (send day 2026-10-26) and snapshot.
- Live switches are ON, not off: announcement on (8am), invoices on, deployment/database/provider all marked verified, approved scope 770c1af7.
- The invoice run is scheduled for noon Chicago (17:00 UTC today). So far: 0 billing runs, 0 delivery attempts, 0 local invoices.
- The database changes ARE installed, even though the source files still say "unapplied": the channel-aware approval and confirm-mapping functions both exist live.
- Customer matching: 26 audit rows, 26 verified matches, 26 QuickBooks links. Frozen cohort: 33 customers in scope, 33 enrollments, 25 invoice approvals.
- Saved billing preferences: 25 customers (12 email, 9 text, 4 both). The 13 that include text all have a recorded text consent date.
- Text opt-outs list: 0 entries. Last mass text: Oct 7, 34 sent, 0 failed.
- Tax setup: NON with a recorded review (who and when), Item 1010000001, income account 5. 3 annual-renewal settings saved.

## Not verified
- Deployed billing server version 8 and the published app build compared with the source.
- Whether Laken, Peggy, Shelby and Jennifer are held correctly, checked by name.
- Per-customer November amounts beyond the sample I looked at ($200 monthly).
- Whether any STOP replies came in to Telnyx after the announcement went out.
- Whether service-visit consent is recorded anywhere outside the billing preferences.

## Blockers / decisions before noon
1. The invoice switch is ON with a 17:00 UTC target. If you are not ready, it needs to be turned off before then. This check did not turn it off.
2. Check STOP replies received since 8am before invoices go out.
3. Only 25 of 33 customers have invoice approvals and only 26 have verified matches. The rest should be skipped, so confirm that is what you intended.

## Proposed next step (needs approval)
A second read-only pass: list each customer by name with their hold, amount, approval and match status, read today's inbound texts for STOP, and check the deployed server version. No sends, no changes.
