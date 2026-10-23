# Outstanding balances: audit findings and proposal

## What the app does today (verified, read-only)
- **Robert Boswell** is an active customer. The app has no invoices, payments, or billing-run records for him. His $220 equipment invoice exists only in QuickBooks.
- **QuickBooks link** can only read data: one invoice by number, or the 10 most recent sandbox invoices (total + balance). It doesn't look up customers, account totals, or past-due invoices, and it doesn't create anything.
- **Monthly invoice creation is not built.** The Invoice Delivery page only proposes amounts for you to approve. Nothing creates or sends invoices or announcements.
- **Customer portal** lets customers choose how invoices reach them (text, email, or both). It shows no balance, invoice list, or past-due notice.
- **Local billing (Phase 1)** tracks each invoice's balance and applies payments to the oldest invoice first. It's off and has zero invoices, so it shows no account totals or alerts.

**Answer:** Right now the $220 will not be added to the $200, and the app won't show it at all. It stays a separate open invoice in QuickBooks.

## Recommendation (not built)
1. Keep invoices separate: the $200 monthly invoice covers only that month's service. Never fold the $220 into it.
2. Show an account summary (read from QuickBooks) next to the new invoice: "This invoice $200 · Earlier unpaid $220 · Total due $420", with each open invoice listed by number.
3. Prevent double counting: build the total from each open invoice's QuickBooks balance, by invoice ID. Never add a past balance to a new invoice's amount, and treat payments as reported by QuickBooks.
4. Past-due notice in the admin review screen and the customer portal. Reminders only after separate approval.

## Technical details
- Add a read-only `customer_open_invoices` action to qbo-connect: one GET query for `Invoice where CustomerRef = X and Balance > '0'`, scoped to the active environment. It needs each client mapped to a QuickBooks customer ID first (none are mapped today).
- Account total = sum of the open balances. Don't store it; read it again before each send.
- Tests: $200 new invoice + $220 open = $420 shown, $200 billed; a partial payment lowers only that invoice's balance; retries don't add anything twice.
