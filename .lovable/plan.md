# QuickBooks sandbox token renewal: verified

## Findings (read-only, 2026-10-23 11:35 UTC)
- Connection: Sandbox Company US b3cd, realm 9341458549860760, environment sandbox, needs_reconnect false.
- Access expiry moved from 08:03 UTC to **12:34:20 UTC** (1 hour after renewal).
- Connection last updated **11:34:20 UTC**, matching your invoice #1030 test.
- Refresh-token expiry still shows 2027-02-01 07:03 UTC.
- Error log: no new entries since 06:32 UTC. The only three entries are the earlier deliberate fake sign-in link tests.

## Conclusion
Renewal worked against Intuit: the expired access was renewed with the saved refresh token, the new expiry was saved, and the invoice lookup succeeded with no errors. The connection is healthy.

## Limitations
- Tokens weren't inspected, so I can't confirm whether Intuit issued a new refresh token. The refresh expiry didn't change, which is normal.
- Invoice #1030's $0 balance comes from your screen, not from my own lookup.

## Next step
No fix needed. The next item is the remaining sandbox checklist: disconnect, then reconnect.
