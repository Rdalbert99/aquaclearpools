# Aqua Clear and QuickBooks Online invoicing (plan only)

QuickBooks Online (QBO) stays the official accounting record. Aqua Clear decides **who gets billed, how much, how often and how the invoice is delivered**. QBO holds the invoices, payments, tax and payment links. Approving this plan builds nothing. Each stage needs its own approval, and nothing is published, sent or created in QBO without your explicit OK.

## Verified starting point (Oct 23)
- The Aqua Clear database has no test customer "Aqua Clear Integration Test" (QBO ID 114) and no invoice #350154860. Billing holds 0 invoices and 0 payments.
- No code talks to QBO today. `clients.qb_customer_id` and `clients.qb_invoice_link` are filled in by hand.
- Already built and reusable:
  - Billing Phase 1 (preview only): `billing_customers`, `invoices`, the ledger and the audit log.
  - Telnyx texting, with `sms_opt_outs` and STOP handling.
  - Email through Resend/Mailjet, plus delivery logs (`message_send_logs`).

## Per-customer billing preferences
Each customer gets one billing profile:
- **Amount:** a flat rate in cents, or itemized (service plus chemicals from visits).
- **Frequency:** weekly, biweekly, monthly, quarterly, six months, annual or one-time. Plus an anchor day, a start date and the next invoice date (calculated and shown).
- **Prepaid Service Discount:** a switch, off by default. It is only offered for six-month and annual billing. See the next section.
- **Creation:** automatic (made on the schedule, then waits in the review queue) or manual (admin only).
- **Delivery:** SMS (Telnyx), email (Aqua Clear or QBO's email), both, or manual/none.
- **Reminders:** days before due, on the due date, and days overdue, each one optional.
- **QBO mapping:** linked QBO customer, product/service item per line, tax code, terms and due days.
- **Status from QBO (read only):** open balance, last payment, payment method type and invoice status.
- **Consent:** SMS opt-in date and source. Opt-outs are always honored, and email opt-out is stored per customer.
- **Paused / active switch:** every customer starts paused.

## Prepaid Service Discount (six months / annual)
- **Rule:** based on the customer's monthly service rate (M).
  - Six months: regular subtotal 6 × M, discount 0.5 × M, total **5.5 × M**.
  - Annual: regular subtotal 12 × M, discount 1 × M, total **11 × M**.
  - Example at $200/month: six months is $1,200 − $100 = **$1,100**. Annual is $2,400 − $200 = **$2,200**.
- **What the discount covers:** prepaid service only. It never reduces tax, extra services, repairs, chemicals or other fees. Tax is worked out on the amount after the discount, following QBO's tax setup (to confirm with your CPA).
- **The invoice shows:**
  - the regular service subtotal
  - a separate "Prepaid Service Discount" line
  - extra lines, if any
  - tax
  - the final total
  - the service coverage start and end dates (for example Nov 1, 2026 – Apr 30, 2027)
  - payment terms (due date, and that the discount is for paying in advance)
- **No stacking:** only one discount per invoice. If another discount or credit is already on the invoice, the draft is blocked with "Discount conflict — review" until an admin picks one. The discount is applied once per coverage period, and the idempotency key includes that period.
- **Not available for** weekly, biweekly, monthly, quarterly or one-time billing. The switch is hidden or disabled for those, and turning it on for them is rejected on the server.
- **Rounding:** all amounts are in whole cents. The discount for six months is M × 0.5 rounded half-up to the cent, so $199.99 gives a $100.00 discount. Total = subtotal − discount, exactly.
- **Changing between six months and annual:**
  - A new frequency starts at the end of the current paid coverage. It never overlaps or leaves a gap.
  - Changing the rate in the middle of a period doesn't change invoices already issued. The new rate applies from the next period.
  - Turning the discount off applies from the next period too.
  - Refunds or credits for a cancelled prepaid period are a manual admin decision in QBO. They are never calculated automatically.
- **In QBO:** the discount goes in as a separate discount line (or a "Prepaid Discount" item, your choice), so the books show gross service and discount separately.
- **Previews:** the matrix and bulk review show each prepaid customer's subtotal, discount, total and coverage dates before activation.
- **Tests (fixed examples):**
  - $200: six months $1,100, annual $2,200
  - $199.99: six months $1,099.95, annual $2,199.89
  - $0 rate: blocked
  - Discount switch on with monthly billing: rejected
  - Tax and extras are not discounted
  - Two discounts on one invoice: blocked
  - Coverage dates across a year end and a leap year (Feb 29)
  - Six months to annual: no overlapping coverage
  - Duplicate draft for the same period: blocked

## Admin overview matrix
One page with a row per customer. Columns:
- customer
- QBO match (matched, suggested or unmatched)
- amount
- frequency
- next invoice date
- creation (auto/manual)
- delivery (SMS/email/both/manual)
- SMS consent
- QBO balance
- last payment
- status (paused/active)

Filters, sorting, inline edit and CSV export are included. **Bulk review:** select rows, then preview the exact invoices and messages that would be made. Activation requires confirming "Activate N customers". Nothing goes live in bulk without that preview.

## Customer matching (no duplicates)
1. Read all QBO customers. This is read only.
2. Match in this order: the saved `qb_customer_id` first, then exact email, phone (E.164), and finally a normalized name. Each match shows a confidence level.
3. An admin confirms each match. Unmatched customers stay unlinked. The app **never creates a QBO customer automatically**. Creating one is a separate manual button, and it checks for existing matches first.
4. Each QBO customer can link to only one Aqua Clear customer. The database enforces this.

## Sync design
- **Stage A, read only:** pull customers, invoices, payments and items from QBO into a cached mirror. This uses QBO webhooks plus a nightly check of recent changes (CDC). Every record keeps its QBO ID and version (SyncToken).
- **Stage B, guarded writes:** create invoices in QBO only from approved drafts, with:
  - A unique key per invoice (customer + period + schedule). It is saved before the call, so a retry never makes a second invoice.
  - A check that QBO doesn't already have that invoice, run before every write.
  - A rate limit and a stop switch (billing mode off / shadow / live, per business).
- **Payments:** read from QBO only. The app never records a payment for a QBO-managed customer, to avoid double entries.
- **Payment links:** QBO's own invoice link, stored per invoice. It replaces the hand-typed `qb_invoice_link`.
- **Reconciliation:** a daily report comparing app drafts and sends against QBO invoices and balances. Any difference gets flagged.

## Delivery, retries and audit
- **SMS:** sent only through the existing Telnyx function. It checks consent and opt-outs first, and the message includes the QBO payment link. The text wording gets your approval.
- **Email:** sent by Aqua Clear's email service or by QBO's built-in "send invoice", chosen per customer.
- **Failed sends:** retried up to 3 times with growing gaps. After that the invoice is marked "needs attention" in the matrix. An invoice can never send twice for the same delivery.
- **Audit log:** every match, preference change, activation, QBO write and send is recorded with who did it and when. The log can't be changed.
- **Timezone:** America/Chicago for all schedules and due dates.

## Safe rollout with the $5 test
1. Connect QBO and read test customer 114 and invoice #350154860 ($5). Confirm the app shows the correct status, balance and payment link. No writes.
2. Link customer 114 to a test Aqua Clear customer that only an admin can see. Turn on shadow mode, which makes drafts but writes nothing.
3. After your OK: one real QBO invoice write for customer 114, then one SMS and one email to **your own** phone and email. Each step needs a preview and an explicit approval.
4. Pay the $5 through the QBO link and confirm the status and payment flow back into the app.
5. Bulk review and activate real customers in small batches. The first real send to any customer always needs approval.

## Staged implementation (cost-conscious)
| Stage | Scope | Rough build messages |
|---|---|---|
| 0 | Your decisions below, QBO connection | 0–1 |
| 1 | Billing preferences + admin matrix (no QBO, no sends) | 3–4 |
| 2 | QBO read-only sync, customer matching, test customer 114 check | 4–6 |
| 3 | Draft generation, review queue, shadow mode | 3–4 |
| 4 | Guarded QBO invoice writes + idempotency | 3–4 |
| 5 | SMS/email delivery, reminders, retries, consent | 3–5 |
| 6 | Reconciliation report + rollout | 1–3 |

The work is staged so you can stop after Stage 2 and already have accurate balances and payment links. Ongoing costs: QBO's API is free with your existing subscription, Telnyx texts are cents each, and no AI is used.

## Technical notes
- The QBO connection uses OAuth2 through a connector, if one is available for this workspace. Otherwise you'd create your own Intuit developer app and add its client ID and secret, plus the webhook verifier token, to Supabase secrets yourself. Tokens are refreshed only on the server.
- New tables, all with `business_id`, access rules and grants:
  - `billing_profiles`
  - `qbo_customer_links` (unique on the QBO ID)
  - `qbo_sync_state`
  - `qbo_invoices_mirror`
  - `qbo_payments_mirror`
  - `invoice_send_attempts`
  - `qbo_write_requests` (idempotency key, unique)
  - `qbo_webhook_events` (deduped)
- New server functions: `qbo-oauth`, `qbo-sync` (scheduled via pg_cron), `qbo-webhook` (checks the signature), `billing-generate-drafts`, `billing-send-invoice`. All are admin-checked except the webhook.
- The existing Phase 1 local invoices stay for non-QBO use. QBO-linked customers use the mirror instead.

## Open decisions
1. Use QBO's own invoice email, or Aqua Clear's emails with the QBO pay link?
2. Itemized visits plus chemicals, or a flat rate per customer?
3. Sales tax: does QBO apply it automatically (AST), or does Aqua Clear set the tax codes? Ask your CPA.
4. Default reminder timing (for example 3 days before due, on the due date, 7 days overdue)?
5. Can automatic customers' invoices go out without review once they're activated, or does every cycle need a bulk approval?
6. Who can see the matrix: admins only?
7. Which QBO products/services items map to "Pool service", "Chemicals" and "Repairs"?
