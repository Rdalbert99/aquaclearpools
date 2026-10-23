# Why the LIVE QuickBooks page says "Intuit app keys missing"

## What the code shows
- The page shows **LIVE**, which means the service read QBO_ENVIRONMENT=production. So the service does receive your Supabase secrets, and the problem isn't the deployment or injection in general.
- In live mode, the service looks for exactly two names: `QBO_PRODUCTION_CLIENT_ID` and `QBO_PRODUCTION_CLIENT_SECRET`. If either one is missing or empty, the page says "keys missing". Sandbox or old keys are never used as a fallback, by design.
- The check only tests whether both settings are present. It never contacts Intuit, so wrong key values can't cause this message. They would only fail later, at sign-in.
- The service restarted at 12:27 UTC, so it is not holding on to old settings from before.
- The Lovable secrets list doesn't show any QuickBooks names, not even the sandbox ones that clearly work. So that list leaves out secrets added in Supabase, and it can't confirm whether a name is missing.
- The sandbox connection (realm 9341458549860760) is untouched and stays saved. It just isn't used while the service is in live mode.

## Likely causes, most likely first
1. **The name doesn't match exactly.** For example a typo, a leading or trailing space, lowercase letters, or "PROD" instead of "PRODUCTION".
2. **One of the two values is empty**, or only one of the two was saved.
3. The keys were saved in a different Supabase project than tbqqigqkbogibwumjyol.

## Safe checks for you (no code changes)
1. Go to Supabase → project tbqqigqkbogibwumjyol → Edge Functions → Secrets. Compare both names character by character with the names above.
2. If a name is wrong, delete it and add it again with the exact name and value. Don't paste the values in chat.
3. Reload the QuickBooks page. It should say "Intuit app keys saved". Don't press Connect until you're ready for the live sign-in.

## Optional small fix (needs your approval)
Add a presence-only line to the status check: "Live client ID found: yes/no" and "Live client secret found: yes/no". It shows no values, lengths or hashes. This pinpoints which name is wrong. It changes no keys, connections or accounting records, and touches nothing in QuickBooks.

## To go back to safe sandbox mode
Set QBO_ENVIRONMENT to sandbox. The saved sandbox connection works again right away.
