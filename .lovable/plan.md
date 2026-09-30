# Aqua Clear Billing & Accounting: implementation plan (plan only)

Nothing is built, changed or published by this plan. October stays in QuickBooks. The target is to be test-ready by **October 15**, and to use the new system for **November only if** the reconciliation and cost gates below pass.

## 1. What we can reuse today
- **Customers:** The `clients` table already has `service_rate`, `service_frequency`, `qb_customer_id`, `qb_invoice_link`, `contact_email` and `contact_phone`, and it's linked to `users` and `client_users` for portal sign-in.
- **Service history:** `services` records the visit date, the chemicals added and their costs (`chemicals_cost`), the chemical usage lines (`service_chemical_usage`), and when a visit was completed. Invoices can point to these real visits.
- **Portal and sign-in:** The customer dashboard already shows a QuickBooks invoice link (`qb_invoice_link`), which the new Invoices & Payments page will replace. Roles and admin/staff checks (`is_admin_user`, `is_staff`) and the access-rule patterns are already in place.
- **Notifications:** Emails (Mailjet) and texts (Telnyx) have send logs and respect each customer's contact preferences. These can send invoices, receipts and payment reminders.
- **Audit pattern:** Append-only logs already exist (`service_status_events`, `security_audit_log`, `client_status_history`).
- **Gaps:**
  - There are no invoice, payment, ledger or business tables.
  - Every table assumes a single business (Aqua Clear only).
  - The service screen's Billing card is a placeholder ("invoicing coming soon").

## 2. Guiding principles
1. **The payment company holds card and bank details.** Aqua Clear stores only their reference IDs, the card brand and last 4 digits, and the mandate status. Card and bank details never touch our servers, which keeps the security compliance burden at its lowest level.
2. **Money records are never edited or deleted.** Invoices are locked once issued. Changes happen through credit notes, refunds and adjustments. Every money event writes an entry to a permanent ledger.
3. **Strict separation between businesses from day one.** Every billing table carries a `business_id`, so Lowery Pest Control or catering can be added later with their own branding, bank account, payment account and books.
4. **Money is stored in whole cents, not fractions of a dollar,** so totals never drift from rounding.
5. **QuickBooks stays the official record** until the cutover gate passes. The original QuickBooks archive is never deleted.

## 3. Choosing the payment company (decide before building payments)
- The candidates are **Stripe** (Billing plus bank payments via ACH/Financial Connections) and **Square**.
- Lovable also has built-in managed Stripe/Paddle payments. That option can only be switched on from the Lovable editor chat. Because this project runs on your own Supabase account, we need to confirm it works with this setup before relying on it. If it doesn't, we connect a Stripe account in your name.
- **Rough cost comparison to confirm with your own numbers:**
  - Stripe cards: about 2.9% + 30¢.
  - Stripe ACH: 0.8%, capped at $5.
  - Intuit charges are often around 2.99–3.5% for cards, and ACH may be flat or percentage-based.
- Your June–August data shows **$603.48 in fees on $14,636 (about 4.12%)**. The mix of card vs ACH payments and the QuickBooks subscription cost are still unknown, so **this does not yet prove switching saves money.**

## 4. Proposed data structure (new tables, nothing changed in existing ones)

```text
businesses ── business_settings (branding, bank/payout label, tax settings, processor account id)
   └─ billing_customers (business_id, client_id → clients, processor_customer_id, autopay, default method ref)
        ├─ billing_plans / recurring_schedules (amount_cents, cadence, anchor day, seasonal flag, active)
        ├─ invoices (number per business, status draft→open→paid/void/uncollectible, period, due, totals, locked_at)
        │    └─ invoice_lines (description, qty, unit_cents, service_id → services nullable, chemical line, tax code)
        ├─ payments (method card/ach/cash/check/other, amount, fee_cents, net_cents, processor ids, status, received_at)
        │    └─ payment_allocations (payment → invoice, amount)
        ├─ credits_refunds (type credit_note/refund, reason, amount, links to invoice/payment)
        └─ payment_method_refs (brand, last4, type, processor id — never PAN/bank numbers)
payouts (processor payout id, arrival date, gross, fees, net, bank label) ── payout_items
ledger_entries (append-only: business_id, account, debit_cents, credit_cents, source table/id, actor, at)
billing_audit_log (append-only: who/what/before/after, including admin overrides)
processor_events (raw webhook payloads, idempotency key, processed_at, error)
qb_import_batches / qb_import_rows (raw archive copy + mapping status; originals untouched)
reconciliation_runs (period, source QB vs app vs bank, differences, sign-off by/at)
```

- **Chart of accounts (minimal):** Service Revenue, Chemical/Parts Revenue, Sales Tax Payable, Accounts Receivable, Processor Clearing, Processor Fees, Bank (per business), Customer Credits, Refunds.
- **Sales tax:** A tax code on each invoice line, with Mississippi rates set per business. Confirm with your CPA whether pool service labor is taxable.

## 5. Access rules
- **Admins:** Full access, limited to the businesses they belong to (via a `business_members` table and a `has_business_role(business, role)` security check).
- **Techs:** Read-only view of invoice status for their assigned customers. They can record a cash or check payment taken on site, which goes into a pending state that an admin approves.
- **Customers:** See only their own invoices, payments and receipts, through `client_users`.
- **Public (not signed in):** No access to anything.
- **Locked-down tables:** `ledger_entries`, `billing_audit_log` and `processor_events` can only have records added, never changed or deleted. Only the server writes to them, using triggers and backend functions. Issued invoices are locked by a trigger.
- **Anything that touches money** (issuing an invoice, charging, refunding, recording a payment) runs through backend functions on the server, never directly from the browser.

## 6. Key flows
- **Monthly recurring invoices:**
  - A scheduled job runs on the 1st (Chicago time). It creates **draft** invoices from each customer's schedule, optionally pulling that month's completed visits and extra chemicals.
  - The draft invoices wait in an admin review queue. You **approve them in bulk**, and then they're sent by email or text.
  - Customers on autopay are charged on the due date.
  - The seasonal schedule does not change billing unless a separate billing plan says so. (This matches the rule already in place.)
- **Payments:**
  - Customers pay in the portal through a checkout page hosted by the payment company, or by autopay using a saved card or bank authorization.
  - Signed webhooks from the payment company (payment succeeded, failed, refund, dispute, payout paid) are checked for authenticity, recorded, and processed only once each. Only then are invoices and payments updated.
- **Cash and check:** Admins or techs record the amount, check number and photo. Those payments are grouped into bank deposits so they match the bank statement.
- **Refunds, credits and disputes:** Refunds go through the payment company. Credit notes adjust the customer's balance. Disputes are recorded as ledger entries.
- **Fees and payouts:** Each payment records its gross amount, fee and net. Payouts from the payment company are matched to bank deposits.
- **Exports:**
  - An invoice register, a payment register, an AR aging report, sales tax by period, fees, and a payout-to-bank tie-out.
  - A general journal export in a QuickBooks-importable file (IIF/CSV) plus plain CSV for your CPA.

## 7. QuickBooks migration and reconciliation
1. **Export from QuickBooks:** customers, open invoices and balances, the last 24 months of invoices and payments, and items. Store the untouched files in private storage (`qb-archive`).
2. **Match customers** to existing Aqua Clear customers using the saved QuickBooks customer ID first, then name, email or phone. Unmatched customers go to a review screen.
3. **Import historical invoices and payments** as read-only history marked `source='quickbooks'`. Bring over **opening balances** as of the cutover date.
4. **Parallel run for October:** QuickBooks stays live, and the app produces "shadow" invoices for the same customers. A reconciliation report compares the count, totals and balance for every customer. **The gate is zero unexplained differences.**
5. **Cost gate:** Pull QuickBooks fee reports broken out by card and ACH, plus the subscription cost, and model the new payment company's fees on the same payments. **Switch in November only if the savings are proven and you sign off.**

## 8. Testing and rollback
- All payments are tested in the payment company's test mode, including cards that get declined, ACH payments that fail, refunds, disputes, repeated webhooks and payouts.
- Automated tests cover invoice math, tax, payment allocation, ledger balance (debits must equal credits) and access rules for customers, techs and a second test business.
- **Feature flag:** each business has a billing mode setting: `off` / `shadow` / `live`. Rolling back means switching back to `shadow` or `off`. QuickBooks stays untouched and ready the whole time.
- Nothing goes live until you explicitly publish, after the October reconciliation.

## 9. Phased timeline

| Phase | Target | Scope | Effort (build messages, rough) |
|---|---|---|---|
| 0. Decisions + cost data | Oct 1–3 | Choose the payment company, confirm with your CPA, pull QuickBooks fee and subscription data | 0 (your input) |
| 1. Foundation (**first safe step**) | Oct 3–7 | `businesses`, members, billing customers, invoices and lines, ledger, audit, access rules; Aqua Clear as business #1; billing mode `off`. Admin-only screens: draft invoices, record cash or check. No payment company, no customer-facing changes. | 6–9 |
| 2. QuickBooks import + reconciliation | Oct 7–12 | Archive upload, customer matching, history import, reconciliation report | 4–6 |
| 3. Payment company in test mode | Oct 10–15 | Customer and payment method references, checkout, autopay authorizations, webhooks, payouts, fees | 6–9 |
| 4. Portal + recurring job | Oct 13–15 | Customer Invoices & Payments page, receipts, monthly draft job, review queue, reminders | 4–6 |
| 5. October shadow run + cost gate | Oct 15–31 | Reconcile against QuickBooks; decide on November | 1–3 fixes |
| 6. November go-live (conditional) | Nov 1 | Billing mode `live` for Aqua Clear | 1–2 |
| 7. Second business | Later | Lowery Pest Control or catering: own branding, payment account, books | 3–5 |

**Rough total for Phases 1–4: about 20–30 build messages.** Exact Lovable credits can't be predicted in advance. Ongoing costs are payment company fees plus a small amount of Supabase usage. No Lovable AI is needed.

## 10. Risks
- The October 15 date is tight. Phases 1–2 are the must-haves, and payments can slip into the shadow period.
- Sales tax rules and the chart of accounts need your CPA's sign-off.
- Autopay authorizations must be collected again from customers; they don't transfer from Intuit.
- The site currently runs on your own Supabase account, so the payment company's webhook signing secret and API keys must be added to Supabase secrets by you.

## Decisions needed
1. Stripe, Square, or check whether Lovable's built-in payments are available?
2. Invoice style: one flat monthly rate, or itemized visits plus chemicals?
3. Should techs be allowed to record cash or check payments in the field?
4. Can you share the QuickBooks export (customers, invoices, payments, fee report) and the monthly QuickBooks subscription cost?
