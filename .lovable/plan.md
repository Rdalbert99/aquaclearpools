# Invoice notification preferences (Text / Email / Both) — plan only

## What exists today (checked)
- `clients.notification_method` (default `email`) is the single service-notification choice, edited only by admins in Client Edit; broadcasts also treat `none` as opted out.
- Customers link to their record via `clients.user_id` / `client_users`.
- Text opt-outs live in `sms_opt_outs` (by phone; STOP adds, START removes) and broadcasts honor them.
- Service-request consent (`sms_opt_in`, `email_opt_in`, `consent_at`) is stored per request, not per customer.
- QuickBooks is read-only; nothing sends invoices today. Email goes through Resend/Mailjet, texts through Telnyx.

## What we'd build
1. **A separate invoice preference** for each customer: Text, Email, Both, or Not set. It never changes the service-notification setting.
2. **Default when not set:** use Email if a verified email is on file, otherwise send nothing and show the invoice as "needs preference" in billing review. Text is never the default.
3. **Customer portal:** a "Billing notifications" card on the customer Profile page with three choices, the masked phone/email being used, and a text-consent checkbox (the wording legally required for texts) that must be ticked for Text or Both.
4. **Admin override:** in Client Edit and the billing overview, admins can set the preference with a required reason. An override is labelled, and the customer sees "Set by Aqua Clear."
5. **Verification:** Email requires a confirmed email (sign-in email or a one-time code link). Text requires a confirmed phone (one-time code by text, sent only after consent). Unverified channels are skipped and flagged.
6. **Consent and STOP:** a number on the opt-out list is never texted, even if the choice is Text or Both. STOP takes priority; START does not turn invoice texts back on by itself. The customer has to choose again.
7. **Invoice message content:** the amount, due date, the QuickBooks payment link once approved, a portal sign-in link (getaquaclear.com/auth/login), and "To change how you get invoice notices, sign in → Profile → Billing notifications." Texts end with "Reply STOP to opt out."
8. **No duplicate sends:** each send is keyed by invoice, channel, and kind (first notice or reminder) with a unique constraint. A retry reuses the same key and never sends twice.
9. **Preview and approval:** before any batch, a billing preview lists each customer, the channels that will be used, and why any are skipped. An admin confirms the count. The first real send is limited to the $5 test customer.
10. **Audit:** every preference change records the old value, the new value, who changed it (customer or admin), the reason, and the time.
11. **Optional one-time announcement:** a "Choose how you get invoices" message, sent only to contacts who already have consent: email to verified emails, text only to numbers with recorded consent that aren't opted out. It needs a preview, confirmation, and a one-time flag, using the existing broadcast safeguards.

## Technical details
- New table `client_billing_preferences(client_id PK, invoice_channel text check in ('sms','email','both') null, sms_consent_at, sms_consent_text, email_verified_at, phone_verified_at, set_by_role, override_reason, updated_at, updated_by)`. GRANT to authenticated/service_role; RLS on. Customers can only select/update their own row (`client_id` in their `client_users`/`clients.user_id`), anon is blocked, admins have full access through `is_admin_user()`.
- Customer updates go through a SECURITY DEFINER RPC `set_my_invoice_channel(channel, consent bool)`. It validates verification and consent, refuses texts to opted-out numbers, and writes to `billing_preference_audit` (insert-only, no update/delete).
- Admin override RPC `admin_set_invoice_channel(client_id, channel, reason)` requires a reason.
- `invoice_notification_sends(id, invoice_ref, client_id, channel, kind, idempotency_key unique, status, provider_message_id, error, created_at)` is service-role write and admin read.
- Sending happens only in a new admin-checked edge function that rereads preferences, opt-outs, and verification on the server. The browser never chooses the recipients.
- Tests: default resolution, a STOP override, unverified channels being skipped, idempotency, own-row RLS, and audit rows.

## Key constraints
- Service notifications and broadcasts stay as they are.
- No invoice creation or QuickBooks writes. Sending stays off until the guarded QuickBooks write phase is approved separately.
- No migration, publish, or messages until you approve.

## Open decisions
- Default for unset preferences: Email if verified (proposed), or hold everyone until they choose?
- Should START bring invoice texts back automatically? Proposed: no.
- Do we confirm phones with a one-time text code, or accept phones staff have already confirmed?
