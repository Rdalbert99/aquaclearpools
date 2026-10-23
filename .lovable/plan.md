# Intuit questionnaire: generative AI check (read-only findings, no changes)

## Recommended answer: YES
The running app makes live calls to generative AI models. These are features of the app itself, not tools used only while building it.

## Verified code paths
1. Technician voice entry (staff only)
   - Screen: `src/components/tech/VoiceEntryDialog.tsx:191` calls `voice-service-entry`.
   - `supabase/functions/voice-service-entry/index.ts`: sends the recording to the Lovable AI Gateway (`ai.gateway.lovable.dev`) for transcription with `google/gemini-3.5-transcribe` (line 134). It then sends the transcript to `openai/gpt-6-astra` (line 163), which turns it into structured readings, chemicals and tasks. The technician reviews the results, and nothing is saved automatically. The request sets `store: false`.
2. Receipt and invoice scanning (admin only)
   - Screen: `src/components/admin/ReceiptImportDialog.tsx:159` calls `parse-receipt`.
   - `supabase/functions/parse-receipt/index.ts:87-95`: sends a photo or PDF of a vendor receipt to `openai/gpt-6-astra` to pull out the vendor, invoice number and line items. An admin confirms the results before they are saved. These are supply-vendor receipts, not QuickBooks invoices.

## Not AI
- There is no customer-facing AI anywhere in the app.
- QuickBooks (`supabase/functions/qbo-connect`, `_shared/qbo-summary.ts`): no AI calls of any kind. It is read-only and only looks up invoices for an admin.
- No direct OpenAI, Anthropic or Gemini software kits or keys exist. All AI traffic goes through the Lovable AI Gateway, and it all happens on the server.
- References to "gpt-eng" in `previewAuthStorage.ts` are just preview web addresses, not AI.

## QuickBooks data and AI training
- No QuickBooks data goes to any AI model, and the code contains no AI training or fine-tuning.
- Suggested answer: QuickBooks data is not used for AI training.
- Not verified: the AI providers' own data-retention terms. The code cannot prove these, so check the Lovable AI Gateway and provider policies if Intuit asks.

## Suggested questionnaire wording
"Yes. Two features for internal staff only use generative AI through a server-side gateway: (1) turning a technician's spoken notes into service-form fields, which the technician reviews before saving, and (2) pulling data from photos of vendor supply receipts, which an admin confirms before saving. No QuickBooks data is sent to AI models or used for AI training, and customers do not interact with AI."

---

# Intuit questionnaire: QuickBooks sign-in and security (read-only findings, no changes)

Overall status: the sign-in code exists, but it has never been run against Intuit. The Intuit app keys (QBO_CLIENT_ID and QBO_CLIENT_SECRET) have not been added yet. The only automated tests cover reading invoice data and checking the return address (`src/lib/__tests__/qbo-summary.test.ts`), not sign-in itself.

| Question | What the code does | Tested? |
|---|---|---|
| Q1 Sandbox connect, disconnect, reconnect | Connect exists (`start` action plus the callback). Reconnect reuses the same flow and replaces the saved connection (`index.ts:106-107`). Sandbox can be turned on with the setting QBO_ENVIRONMENT=sandbox (line 19). **There is no disconnect feature and no token revoke call.** | No. Nothing has been tested against sandbox or production. |
| Q2 Token refresh timing | Refreshes on demand: when an invoice lookup runs and the access token has less than 2 minutes left (`freshConnection`, line 59). There is no scheduled background refresh. | No. |
| Q3 Retry after a failed sign-in | None. A failed token request throws an error, which shows up as a 502 message (lines 38, 171-173). There is no retry or backoff. | No. |
| Q4 Prompt to reconnect on sign-in errors | Partly. The admin sees the raw error text, and the button changes to "Reconnect QuickBooks" (`QuickBooksConnection.tsx:98`). There is no specific "your session expired, please reconnect" prompt. | No. |
| Q5 Intuit discovery document | **No.** The sign-in and token addresses are fixed in the code (lines 21-22). | Not applicable. |
| Q6a Expired access token | Refreshed before the lookup (line 59). | No. |
| Q6b Expired refresh token or invalid_grant | Not handled specifically. The refresh request fails with an error that contains Intuit's text, and the saved connection stays in place. The expiry date is stored but never checked. | No. |
| Q6c Forged-request protection (CSRF/state check) | Yes. Each sign-in gets a random one-time code that is stored, expires after 10 minutes, and is checked and marked used on return (lines 80-84). The return address is limited to an approved list. | Not run against Intuit. |
| Q7 OAuth Playground or offline tools | **No.** Tokens come only from the live sign-in flow. The code never uses the Playground or offline tokens. | Not applicable. |

Other verified facts: only signed-in active admins can use these actions (lines 121-127). Tokens stay on the server, in tables only the server can access. The connection only requests accounting access, and the app never writes anything to QuickBooks.

Gaps to fix before answering "yes" to Intuit (suggested work, not built):
1. Add a disconnect feature that calls Intuit's revoke address.
2. Load the sign-in addresses from Intuit's discovery document.
3. Detect invalid_grant and expired refresh tokens: clear the saved connection and show a clear "Reconnect QuickBooks" prompt.
4. Retry short network failures with a limit; never retry invalid_grant.
5. Run and record a full sandbox test of connect, refresh, disconnect and reconnect.

---

# Intuit questionnaire: error handling (read-only findings, no changes)

| Question | Evidence | Suggested answer |
|---|---|---|
| 1. Have syntax, validation and API errors been tested? | Tested, as documented in `qbo-summary.test.ts`: invoice-number validation rejects input that could tamper with the query; an empty QuickBooks response returns "not found"; the return address is checked. **Not tested:** error replies from QuickBooks, unreadable or malformed QuickBooks responses (`JSON.parse` at `index.ts:39,53` has no specific handling and falls through to a general 502), and token failures. Nothing has been run against Intuit, because the app keys aren't set. | **No.** Only partly tested. |
| 2. Is Intuit's `intuit_tid` header saved? | Not in the code: a search finds no `intuit_tid`. `qboGet` and `tokenRequest` keep only the status and response text. | **No** |
| 3. Are errors stored in lasting logs that can be shared with support? | Only through `console.error` (`index.ts:50,104,111,172`), which goes to the server's temporary log stream. No QuickBooks error is saved to a database table. The admin page shows the raw error text on screen (`QuickBooksConnection.tsx:76`) but does not keep it. | **No.** Only temporary server logs exist. |
| 4. Can customers contact support from inside the app? | Yes, for the regular app: there is a `/contact` page (`App.tsx:111`) with phone 601-447-0399 and email info@getaquaclear.com (`Contact.tsx:41,56,117`). The customer dashboard links to it (`client/Dashboard.tsx:188,575`), the commercial portal login links to it (`PortalLogin.tsx:123`), and the top bar and footer show the phone number. The QuickBooks admin page has **no** support link. There is no support form; the service-request form is for pool service. | **Yes** for the customer app. Note that the QuickBooks page has no support link. |

Gaps to close before answering more strongly (suggested, not built):
1. Save the `intuit_tid` header from every QuickBooks reply.
2. Add an admin-only table that permanently records QuickBooks errors: when, what action, status, Intuit's error code and message, and `intuit_tid`, with no tokens. Show these on the admin page with a copy button.
3. Handle unreadable QuickBooks responses and Intuit's error format explicitly, and show friendly messages.
4. Add tests with sample error replies: 400, 401, 403, 429, 500, and malformed responses.
5. Add a support link on the QuickBooks page.
