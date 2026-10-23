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
