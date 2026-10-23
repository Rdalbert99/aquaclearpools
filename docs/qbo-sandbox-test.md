# QuickBooks sandbox end-to-end checklist

Status: NOT YET RUN — Intuit sandbox app keys are not configured.
Prerequisites: QBO_CLIENT_ID / QBO_CLIENT_SECRET (sandbox app) and QBO_ENVIRONMENT=sandbox saved as server secrets; redirect URI registered in the Intuit app.

Record for each step: date, who ran it, result, intuit_tid (from /admin/quickbooks error log or browser response).

| # | Step | Expected | Date / by | Result | intuit_tid |
|---|------|----------|-----------|--------|-----------|
| 1 | Connect QuickBooks | Returns with "QuickBooks connected", company name shown | | | |
| 2 | Test connection with a sandbox invoice number | Amount/balance shown | | | |
| 3 | Force refresh (set access_expires_at to past via SQL, then test) | Lookup succeeds, new expiry saved | | | |
| 4 | Disconnect | "Disconnected and access revoked at Intuit"; app gone from Intuit connected apps | | | |
| 5 | Reconnect | Connected again | | | |
| 6 | Revoke inside QuickBooks, then test | "Reconnect needed" banner; invalid_grant entry in error log | | | |
| 7 | Decline consent on Intuit screen | "sign-in didn't finish" with reason | | | |
| 8 | Reuse an old callback URL | "link expired or is invalid" | | | |
