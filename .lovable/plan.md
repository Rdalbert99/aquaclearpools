# Provider-neutral AI command layer for Aqua Clear: analysis and phased plan

This is a plan and discussion only. Approving it does not build or publish anything.

## Recommendation in one line
Build **one secure Aqua Clear Actions API** (Option B) as the core. Any assistant can use it: ChatGPT, Claude, Gemini, Grok, or a future one. Add an MCP adapter on top later (Option C), once hosting allows. Keep in-app voice (Option A) as a separate feature. With this design, commands from outside assistants use **no Lovable AI credits**.

## What exists today
- **In-app voice entry** is built in Preview and not published. Each use makes two paid Lovable AI requests: one to turn speech into text, and one to fill in the form.
- **No server-side action layer.** On My Way, start, readings, chemicals, notes, follow-ups and complete are all handled inside the service visit screen, which writes straight to the database.
- **Permissions to reuse:**
  - Techs see only customers where they are the primary or secondary technician.
  - Visits are logged append-only in the visit history (`service_status_events`).
  - Admin checks run on the server.
- **Important limit:** This app uses Randy's own Supabase account, not Lovable Cloud. Lovable can deploy regular backend functions there, which is how the receipt scanner and voice entry run. **Lovable cannot deploy an app-hosted MCP server on this setup.** Option C needs either a later move to Lovable Cloud or a small MCP adapter hosted somewhere else.

## Options compared

| | A. In-app voice | B. Actions API (recommended core) | C. MCP tool layer |
|---|---|---|---|
| What it is | Mic inside Aqua Clear, speech turned into form fields, then review | Secure web endpoints with defined actions and permissions | The same actions offered in the MCP tool format that AI clients understand |
| Works with | Aqua Clear only | Any assistant that can call a web API (Custom GPT actions, Gemini/Claude tool use, scripts, Zapier) | ChatGPT, Claude and others with MCP support; growing standard |
| Vendor lock-in | None | None (published OpenAPI description) | None (open standard) |
| Lovable AI credits per use | Yes, 2 requests per dictation | **None**: fixed actions, no AI | **None**: calls the same API |
| Who pays for the AI thinking | Aqua Clear (Lovable credits) | Randy's AI subscription (ChatGPT, Claude, etc.) | Randy's AI subscription |
| Build effort | Done; small tuning left | Medium | Small once B exists, but hosting is blocked on this setup |

**Why B first:** It carries all the security, permissions, confirmations and audit logging. MCP (C) then becomes a thin translator that calls the same API, so none of the safety logic has to be written twice. Both are open standards, so nothing ties Aqua Clear to one AI company.

## Architecture (Option B, with C layered on)

```text
Assistant (ChatGPT / Claude / Gemini / Grok / ...)
      |  OAuth sign-in as Randy (or a scoped personal token)
      v
Aqua Clear Actions API  (backend functions, fixed actions, no AI)
      |  checks: identity -> permission scope -> customer assignment
      |  risky action? -> returns "confirmation needed" + one-time code
      v
Database (all access rules still apply)  +  audit log "via <assistant>"
      ^
Optional MCP adapter (later) -> calls the same API
```

### Identity and permissions
- Every call acts **as a real Aqua Clear user**, never with the master admin key. Database access rules still apply, so a tech can only reach their own assigned customers.
- **Connection:**
  - Phase 1 uses **personal access tokens** that Randy creates in Settings → Connected Assistants. They are stored only in scrambled (hashed) form, can be given an expiry, and can be revoked at any time.
  - Phase 3 adds standard **OAuth** sign-in so assistants connect with Log in with Aqua Clear.
- **Permission scopes** on each token or connection:
  - `read:route`: customers, today's stops, last readings
  - `write:visit`: draft readings, chemicals, notes, equipment
  - `notify:customer`: On My Way and completion texts or emails
  - `complete:visit`: finalize a visit
  - `admin:*`: never granted in the first versions
- **Rate limits** use the existing `check_rate_limit` function.

### Confirmation model

| Immediate | Needs confirmation (a second call with a one-time code, shown in the assistant as "Say yes to send") |
|---|---|
| Find customer, today's route, last readings, dosing advice | Send On My Way (texts or emails the customer) |
| Open a draft visit, start the visit timer | Complete visit (saves it, uses inventory, may notify the customer) |
| Add or edit draft readings, chemicals, notes, equipment observations, follow-up flag | Complete without notifying, create a scheduled follow-up, send any message |
| | Blocked: customers not assigned to you, and admin or billing actions |

- **Draft first:** assistant edits go into an unsaved draft visit. That draft is what Randy sees in the app, and he can review and save it there as well.
- **Audit log:** every call is recorded with who made it, which assistant, the action, the customer, the result, and the time. It also appears in the visit history as "via Claude", "via ChatGPT" and so on.

### First set of actions
`find_customer`, `todays_route`, `get_customer_summary`, `open_visit`, `start_visit`, `set_readings`, `add_chemicals`, `add_note`, `flag_equipment`, `flag_follow_up`, `send_on_my_way` (confirmation), `complete_visit` (confirmation).

Inputs are structured. For example, `{chlorine: 2.5, ph: 7.6}`, or chemicals as `{product, quantity, unit}` with gallons for liquids and pounds for powders, matched to the chemical catalog. Because the assistant does the understanding, Aqua Clear needs no AI of its own for these actions.

## Phased rollout and build cost

Exact Lovable credits can't be predicted. They depend on how complex each message is and how many fixes are needed. These relative estimates count build messages.

| Phase | Scope | Effort |
|---|---|---|
| 1. Shared visit actions | Move the service-screen logic into shared server actions; the app screen uses them too. This makes the app more reliable even without AI. | Medium, about 5–8 messages |
| 2. Actions API MVP | Personal tokens with scopes, a Connected Assistants settings page, read and draft actions, a confirmation flow for On My Way and Complete, audit log, rate limits, OpenAPI description, one test with a Custom GPT or Claude tool | Medium, about 6–9 messages |
| 3. OAuth sign-in | Log in with Aqua Clear for assistants; consent screen; revoke | Medium, about 3–5 messages |
| 4. MCP adapter | Offers the same actions as MCP tools. Needs Lovable Cloud or outside hosting (see limit above). | Small, about 2–4 messages, after the hosting decision |
| A. In-app voice | Already built. Optional: free phone dictation plus a local reader for readings to cut cost. | About 1–3 messages |

**Useful MVP is Phases 1 and 2: about 11–17 build messages.** Phases 1–3 together are about 14–22. For comparison, Option A's remaining work is about a tenth of that.

## Ongoing running costs

| Item | Paid by | Rough cost |
|---|---|---|
| Assistant listening, thinking and speech (ChatGPT, Claude, etc.) | Randy's AI subscription | Covered by his plan; no Aqua Clear cost |
| Actions API calls | Aqua Clear's Supabase hosting | Uses the existing plan's backend-function allowance (Supabase Pro includes about 2M calls a month). One stop is about 5–15 calls, so effectively $0 at this scale. |
| Lovable AI credits for outside assistant commands | none | **$0**: the actions are fixed and use no AI |
| Customer texts and emails from On My Way or Complete | Aqua Clear (Telnyx, Mailjet) | Same as today, per message |
| Option A: one 30–60 second dictation | Aqua Clear (Lovable AI credits) | 2 requests: speech-to-text, which grows with recording length, plus a small form-filling request. After one real test, check the project's AI request logs for the exact amount. |
| Option A with free phone dictation plus local reader | Aqua Clear | 0 requests for routine readings; 1 small request only when the reader can't understand the text |
| OAuth and tokens | Aqua Clear | $0 (existing Supabase sign-in) |
| MCP adapter hosted outside Lovable (if chosen) | Aqua Clear | Usually free to a few dollars a month on a basic serverless host |

**One design rule keeps this cheap:** Aqua Clear never sends raw conversation text to its own AI when the request comes from an outside assistant. The assistant sends structured values. If an assistant ever sends free text, the API rejects it and asks for fields, rather than paying for an AI to interpret it.

## Constraints to keep in mind
- **Inbound texts:** `TELNYX_PUBLIC_KEY` is still missing, so replies and delivery receipts don't land. On My Way sending still works.
- **MCP hosting** is blocked on this setup until there's a hosting decision.
- **Draft visit table:** a new draft table, or a draft status on existing visits, will be needed.
- **Existing site:** nothing changes for current users until Phase 1 is approved. Nothing is published without your go-ahead.

## Decisions needed
1. Start with Randy only, or with every tech?
2. Is the Phase 1 personal token connection acceptable, or should the MVP wait for OAuth sign-in?
3. MCP later: move to Lovable Cloud, host the adapter elsewhere, or skip MCP and use the API only?
