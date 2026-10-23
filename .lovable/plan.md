# QuickBooks build batch: compliant live access (read-only)

Goal: make QuickBooks sign-in, error handling and security meet Intuit's questionnaire so live access can be approved. The app stays read-only. Out of scope until separately approved: automatic invoicing, customer messages, and any writes to QuickBooks or the live database beyond the connection and error-log records.

## Background (verified read-only, Oct 23)
- Generative AI: the questionnaire answer is Yes. Voice entry (`voice-service-entry`: transcription with Gemini, then GPT turns it into form fields) and receipt scanning (`parse-receipt`, GPT) are staff-only. No QuickBooks data reaches AI, and nothing is used for training.
- Sign-in today: the forged-request (state) check and admin-only access exist. Missing: disconnect/revoke, discovery document, invalid_grant handling, retries.
- Errors today: errors go only to temporary server logs (`console.error`); `intuit_tid` is not saved; no tests for QuickBooks error replies; the customer app has a /contact page, but the QuickBooks page has no support link.
- Nothing has been run against Intuit, because the app keys are not set.

## Priority 1: required for compliant live access
1. **Disconnect.** Add a "Disconnect QuickBooks" button that calls Intuit's revoke address for the refresh token and then deletes the saved connection. If revoke fails, still delete locally and record the error.
2. **Expired refresh token and invalid_grant.** On invalid_grant, or when the refresh-token expiry date has passed, mark the connection "needs reconnect", stop using it, and show a clear "Reconnect QuickBooks" prompt.
3. **Discovery document.** Load the sign-in, token, revoke and user-info addresses from Intuit's discovery document (sandbox or production). Cache it for 24 hours and fall back to the last good copy.
4. **Bounded retries.** Retry network errors, 429 and 5xx up to 2 times, with a growing wait plus random jitter and respecting Retry-After. Never retry 400, 401 (except one token refresh, then one retry), 403 or invalid_grant.
5. **Save `intuit_tid`** from every Intuit reply and show it in the logs and error messages.
6. **Lasting error log.** Create a new admin-only table, `qbo_error_logs`. Each entry stores the time, action, address path without query values, status, Intuit's error code and message (shortened), `intuit_tid`, and the user who triggered it. It never stores tokens, secrets, authorization codes or customer personal details. Show it on the admin page with a copy button, and delete entries after 180 days.
7. **Malformed responses.** Read replies safely; handle replies that aren't JSON and Intuit's `Fault` error format; show friendly messages and log the details.
8. **Support link** on the QuickBooks admin page, pointing to the /contact page with the phone number and email.

## Priority 2: tests (automated, deterministic)
Pull the sign-in and error handling into separate helper code so tests can drive it with fake replies:
- Error replies 400, 401, 403, 429 (with and without Retry-After), 500 and 503: correct message, retry count, and an error-log entry that includes `intuit_tid`.
- Malformed replies: non-JSON body, empty body, `Fault` body, and missing QueryResponse.
- Token handling: access token about to expire leads to one refresh; invalid_grant leads to "needs reconnect" with no retry; expired refresh token leads to "needs reconnect".
- State check: missing, unknown, expired or reused state is rejected, and the return address only allows approved sites.
- Clean logs: neither the log helper nor its output ever contains token or secret values.
- Disconnect: revoke is called and the saved connection is deleted; if revoke fails, the connection is still deleted and the error is logged.
- Discovery: addresses are read correctly; if the fetch fails, the cached copy is used.

## Priority 3: sandbox end-to-end check (manual, written down)
Add a checklist to `docs/qbo-sandbox-test.md` covering: connect, test lookup, forced refresh, disconnect (confirm on Intuit's side), reconnect, invalid_grant (revoke in Intuit, then look up), and declining consent. Record the date, who ran it, the result and the `intuit_tid` for each step. Do not claim these steps until they have been run. This needs the sandbox Intuit app keys and QBO_ENVIRONMENT=sandbox.

## Security acceptance criteria (each needs proof before claiming)
- The Intuit client ID and secret exist only as server secrets. A search of the app's code and the built site finds no secret, and no log line prints them.
- Tokens are stored in tables only the server can reach. Confirm with a database query that admins, technicians, customers and signed-out visitors cannot read them.
- Every QuickBooks action checks that the caller is an active admin. Tests confirm technicians, customers and signed-out callers are refused (401/403).
- The forged-request (state) check is single-use with a 10-minute expiry and an approved list of return addresses (covered by the tests above).
- Data separation: only one connected QuickBooks company, readable only by admins. The new error-log table blocks signed-out visitors and allows admins only. No QuickBooks data reaches customer or technician screens.
- Sensitive data: an audit confirms no personal details or tokens in logs or error messages, and no QuickBooks data sent to AI.
- Questionnaire claims about MFA, CAPTCHA or WebSockets are made only if verified. Current status is unverified or not used: the app does not use WebSockets for QuickBooks, and there is no CAPTCHA or required MFA in the code.

## Technical notes
- Changes cover: `supabase/functions/qbo-connect/index.ts`, new `supabase/functions/_shared/qbo-oauth.ts` (discovery, retries, error parsing, log cleaning), `QuickBooksConnection.tsx`, one change to the database (the `qbo_error_logs` table plus a needs-reconnect flag on `qbo_connections`), and tests in `src/lib/__tests__/qbo-oauth.test.ts`.
- Record the rule in AGENTS.md: all Intuit calls go through the shared helper (retries, `intuit_tid`, clean logging).
- Kept small to save credits: no recurring billing, matching or messaging work in this batch, and no publishing.
