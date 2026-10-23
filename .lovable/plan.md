# Live QuickBooks sign-in: diagnosis (read-only)

## What happened
- Three live sign-in attempts (12:49, 12:50, 12:51 UTC) all reached Aqua Clear's server with a valid one-time state.
- Each time, Intuit rejected Aqua Clear's app keys when swapping the sign-in code for access: HTTP 401, error `invalid_client`.
  Intuit refs: `1-6adb57ed-765ff03752d223786ae8e303`, `1-6adb581f-491f0f570f0dfda10910e973`, `1-6adb5835-438a04cf6fd22b232847197b`.
- No live connection was saved. The only saved connection is still the sandbox one (realm 9341458549860760, healthy). Nothing was written to QuickBooks.
- The server sent you back to the preview's `/admin/quickbooks?qbo=error&reason=token_exchange_failed`, as designed. It does not send you to the home page on purpose. Landing on the home page most likely means the preview tab opened without your Aqua Clear sign-in, so the admin-only page bounced you away. I have not confirmed this.

## Cause
`invalid_client` means Intuit does not accept the production Client ID and Client Secret pair being sent. Common reasons:
- The secret saved is the Development secret, or comes from a different Intuit app than the ID.
- There is a stray space or line break in a value.
- The secret was regenerated at Intuit after you saved it.
Because the ID got through Intuit's sign-in screen, the Client Secret is the most likely problem. That is a guess.

## Next safe step (no code change needed)
1. In Intuit Developer, open the same app, go to Keys and credentials, then Production. Copy the Client ID and Client Secret again.
2. In Supabase Edge Function Secrets, replace `QBO_PRODUCTION_CLIENT_ID` and `QBO_PRODUCTION_CLIENT_SECRET` with those values. Paste each one cleanly, with no spaces.
3. Sign in to Aqua Clear in the preview, open `/admin/quickbooks`, and confirm it says LIVE with both keys detected. Then press Connect once.
4. If it fails again, tell me and I'll read the new error log entry.

## Optional small fix, only if you approve it
- Show "Intuit rejected the app keys (invalid_client)" on the QuickBooks page instead of a generic failure.
- Keep `?qbo=` in the address through the sign-in redirect so the result still shows after you sign in.
No other changes to tokens, secrets or accounting.
