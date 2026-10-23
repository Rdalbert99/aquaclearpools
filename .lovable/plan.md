# Read-only check: live QuickBooks keys saved (Oct 23, 12:22 UTC)

## What I could verify
- **Secret names:** The secrets list I can see shows 13 names, and none of them are QuickBooks settings. That includes QBO_ENVIRONMENT and the sandbox keys, and the sandbox connection works, so this list clearly misses secrets added directly in Supabase. **The live keys are not confirmed, but they aren't shown missing either.**
- **Sandbox connection:** There is one saved connection: "Sandbox Company US b3cd", realm 9341458549860760, environment sandbox, needs_reconnect false. Refresh access is valid until 2027-02-01. The newest error log is from 06:32 UTC, which is before the renewal at 11:34. No new errors since. The current access token expires at 12:34 UTC, and the next lookup renews it automatically.
- **No live connection exists**, so nothing has signed in to live QuickBooks.
- **Key selection code is in place:** production uses only QBO_PRODUCTION_CLIENT_ID/SECRET and refuses to start without them. Sandbox never uses the live keys. Connections are filtered by environment, and the code only reads from QuickBooks. Tests cover all of this.

## Not verifiable from here
- Whether QBO_ENVIRONMENT is still "sandbox". The setting can't be read, but the saved connection being sandbox and healthy is consistent with it.
- Whether the live keys are correct, or whether Intuit has approved live access.

## Safe next steps
1. Open the QuickBooks page in the preview. It should still say SANDBOX and connected. Run invoice #1030 once to confirm.
2. In Supabase → Edge Functions → Secrets, check that the names QBO_PRODUCTION_CLIENT_ID and QBO_PRODUCTION_CLIENT_SECRET appear exactly as written. Don't copy the values anywhere.
3. **Switching needs your explicit approval.** When ready, you change QBO_ENVIRONMENT to production. The page should show LIVE and "not connected", and the sandbox connection should stay.
4. Connect, sign in to the real Aqua Clear Pools company, and test invoice #350154860 (expect $5 paid, $0 balance). Read-only.
5. Switch back to sandbox afterwards if you want, and confirm the sandbox still connects.

No changes were made.
