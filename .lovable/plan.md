# Safety review: switching QuickBooks from sandbox to live (read-only)

## Earlier result: sandbox renewal verified
At 11:34 UTC, access expiry moved from 08:03 to 12:34 UTC. needs_reconnect is still false and no new errors were logged. The sandbox connection is healthy.

## What happens if you just swap the three settings today
| Risk | Today's behavior | Severity |
|---|---|---|
| Wrong connection used | The service loads the newest saved connection without checking whether it's sandbox or live. After the switch it would send the sandbox token to live QuickBooks, get rejected, try to renew it with the live keys, fail, and mark the connection "needs reconnect". | Medium: noisy errors, no damage |
| Sandbox connection erased | When the live sign-in finishes, every saved connection with a different company ID is deleted. That wipes the sandbox connection. | Medium: sandbox must be reconnected later |
| Mixing within one row | The same company ID can't be saved twice, and each row stores its environment. The row's environment label isn't checked when it's used, though. | Low |
| Status page | It shows any one saved connection with no filter, so it could show sandbox details while running live. | Low: confusing |
| Changing live accounting records | **None possible.** Every QuickBooks call is a read (company info, invoice lookup). The sandbox invoice list is blocked outside sandbox mode. The code never creates, changes or deletes anything in QuickBooks. | None |
| Keys exposed | The keys are read only on the server, and logs are scrubbed. | None |

## Is live access actually approved?
**Not verified.** Being able to see live keys in the Intuit portal doesn't prove approval. Intuit only issues live keys after the app's live questionnaire and assessment are complete. I can't see your Intuit account, so the only real proof is a successful live sign-in plus a read of the company info. Also, the QuickBooks settings don't appear in this project's secrets list (13 other secrets are listed), so I can't confirm which values the running service uses.

## Recommended minimal setup
1. **Separate keys per environment:** QBO_SANDBOX_CLIENT_ID/SECRET and QBO_PRODUCTION_CLIENT_ID/SECRET, plus QBO_ENVIRONMENT as the active switch. Sandbox keys stay in place, so you can switch back at any time.
2. **Only use connections for the active environment:** every lookup filters by environment. Refresh, test and status all use the active environment's keys and web addresses.
3. **Delete only within the same environment:** a new live sign-in can replace an old live connection but never touches the sandbox one.
4. **Status page:** show the active environment and connection prominently, with a red "LIVE" badge in production.
5. **Keep the no-writes rule:** add a test that fails if any QuickBooks request other than a read appears outside sign-in, renewal and revoke.
6. **Tests:** environment filtering, choosing the right keys, deleting within one environment only, a sandbox token never reaching live addresses, and the reads-only check.

## Rollout steps (after approval)
1. Build the changes above. The sandbox connection must stay connected. Re-run invoice #1030 to confirm.
2. You add the two live keys in Project Settings → Secrets. Don't paste them in chat.
3. Set QBO_ENVIRONMENT to production. The page should show LIVE with "not connected", and the sandbox connection should still exist.
4. Connect QuickBooks and sign in to the Aqua Clear Pools company. Check the company name and ID.
5. Read-only test of invoice #350154860: expect $5 paid, $0 balance.
6. Before going back to sandbox: switch QBO_ENVIRONMENT to sandbox and confirm the sandbox connection still works.
7. Publish only when you say so. No billing automation or writes until they're approved separately.

## Limits of this review
Based on the current code, the database layout and the list of secret names. Neither Intuit's live approval status nor the actual setting values could be checked.
