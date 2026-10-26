# November 2026 invoice batch — live go/no-go (read at 17:00 UTC, noon CT)

## Verdict: NOT safe to send. The run has already started.

## Verified in the live database (read-only)
- The noon run fired at 17:00:00 UTC. It made 3 billing runs: Robert Boswell (monthly), Shannon Braswell (monthly) and **Peggy McQuarter (annual)**.
- All 3 are **blocked** (code "owner_manual_delivery_after_email_bounce"). None has a QuickBooks invoice ID, none is marked as about to create one, and there are 0 delivery attempts. So far, no invoice has been created or sent.
- The invoice switch is **still ON**. The other approved customers have not been processed yet, but a later pass or retry could still pick them up.
- 0 local invoices.

## Your exclusions compared with the live roster
- Shelby Thames: no approval and no match, so she would be skipped. OK.
- **Jennifer Robinson: enrolled, approved and matched, at $250 monthly. She WOULD be billed.** This goes against your exclusion.
- **Peggy McQuarter: has an approval and a run was created as annual.** This goes against "not approved". It is blocked right now but still exists.
- Laken Ford Ramey: not enrolled, no approval. OK.
- Unclear accounts with no approval, so they would be skipped: Peterson (no match), Bill Foley and Cindy Thames (start December), Leanne, Stacy and Waits (not enrolled, $0).
- 23 customers have approvals. 21 remain after removing Jennifer and Peggy. I did not check those 21 amounts against your price list: rates run from $160 to $500, and Rameys is $500.

## Not verified
- That the deployed billing server matches the source, and the published app version.
- QuickBooks create/send ability, and whether the text and email providers really accepted these.
- STOP replies at Telnyx outside the app's records.
- Why all 3 are blocked with an "email bounce" code.

## Required decision (needs your approval)
1. Turn the invoice switch OFF right away. This is one setting, and nothing gets sent.
2. Then remove the approvals for Jennifer and Peggy and close Peggy's blocked annual run, keeping all records.
3. Re-check the 21 remaining amounts with you before switching it back on.

No changes have been made. Approving this plan approves only step 1, plus a read-back confirming the switch is off.
