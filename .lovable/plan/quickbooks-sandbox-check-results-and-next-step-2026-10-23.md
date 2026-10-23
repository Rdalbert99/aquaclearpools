# QuickBooks sandbox: check results and next step

## What was checked (read-only)
- Secret names visible to Aqua Clear: QBO_CLIENT_ID, QBO_CLIENT_SECRET and QBO_ENVIRONMENT are NOT in the list. The other 13 secrets (Resend, Telnyx, Mailjet and others) are there.
- The QuickBooks sign-in service is live and working:
  - A request without a signed-in admin is rejected (401).
  - A made-up sign-in link (forged state) is rejected (400, "link expired or is invalid").
  - A sign-in link with no state is rejected (400).
- Sandbox mode can't be confirmed yet because QBO_ENVIRONMENT isn't visible. Without it, the service defaults to production.
- The "Connect QuickBooks" button can't start a sign-in until the keys are visible. The page will show "QuickBooks app keys are not set up yet".

## Blocker
The three QuickBooks settings were probably saved under a different project, or in another place, or with slightly different names (for example a space or lowercase letter).

## Next step for you
1. Open Project Settings → Secrets for this project (the Supabase project tbqqigqkbogibwumjyol, under Edge Functions → Secrets).
2. Add these three, with exactly these names: `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET` and `QBO_ENVIRONMENT`. Set QBO_ENVIRONMENT to `sandbox`, and use the Development keys from Intuit.
3. In the Intuit app's Development settings, check that this Redirect URI is registered: `https://tbqqigqkbogibwumjyol.supabase.co/functions/v1/qbo-connect`
4. Tell me when that's done. I'll run the same read-only check again, then you can tap Connect QuickBooks at /admin/quickbooks.

Nothing was changed, sent or published.
