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
