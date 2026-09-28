# Charlie + Aqua Clear: feasibility and cost analysis (no build yet)

This is analysis only. Approving it does not build or publish anything. Tell me which layer to build, or when.

## What already exists
- **Layer 1 is already built in Preview** and not published. The service visit screen has a Voice entry button. It makes two paid AI requests: one to turn speech into text, and one to turn that text into readings, chemicals, tasks, equipment notes and follow-ups. Then a review screen appears, and the visit is saved only when the tech taps Save.
- **Service actions run inside the app screen.** On My Way, start, readings, chemicals, complete and follow-ups are all handled by the service visit screen, which writes straight to the database. No server-side "action" layer exists for an outside assistant to call.
- **Permissions already exist in the database.** Techs only see customers where they are the primary or secondary technician, and the visit history log is append-only. An outside assistant can reuse those rules if it acts as the tech.
- **Constraints:** Customer texts depend on Telnyx, and inbound replies and delivery receipts still need `TELNYX_PUBLIC_KEY`. The chemical math (gallons for liquids, pounds for powders) and the pool health score live in shared code that can be reused.

## Layer 1: voice entry inside the app
- **Status:** Done in Preview. What's left is testing in the field and tuning.
- **Optional way to save money:** Use the phone's free built-in dictation, then run a simple local reader that recognises patterns like "chlorine 2.5" or "pH 7.6". Send text to the AI only when the local reader can't understand it. Most routine dictations would then cost nothing.
- **Remaining build effort:** Small. Field tuning plus the free-dictation option is about 1–3 build messages.

## Layer 2: Charlie controls Aqua Clear from a conversation

### What needs to be added
1. **Server-side action functions** that do the same things the service screen does today: find a customer, show today's route, mark On My Way, start a visit, add readings, log chemicals, add notes or follow-ups, and complete a visit. This is the main work. It's a moderate refactor, not a rewrite: the logic moves from the service screen into shared server actions, and the screen then calls those same actions.
2. **A draft visit.** Charlie fills in an unsaved draft for the visit. Randy can finish it by voice ("Charlie, complete it") or review it in the app.
3. **An MCP server** (a secure tool connection for AI assistants) that offers those actions as tools. ChatGPT supports connecting to MCP servers, and this is the mechanism most like how QuickBooks and Gmail work with ChatGPT. A plain API would also work, but ChatGPT has no native way to call a custom API without a custom GPT, so MCP is the better choice.
4. **Sign-in for Charlie.** Randy connects Charlie once, from ChatGPT, by signing in with his own Aqua Clear account (a standard OAuth sign-in). After that, every action runs as Randy, so the existing "techs only see their own customers" rules apply automatically. Randy can cut Charlie off from the admin area. The master admin key is never given to ChatGPT.
5. **Audit trail.** Every action is written to the existing visit history log, marked "via Charlie".

### Which actions need confirmation
| Immediate (read-only or easy to undo) | Charlie reads back and waits for "yes" |
|---|---|
| Find a customer, today's route, last readings, dosing advice | On My Way (texts the customer) |
| Add readings, chemicals, notes and tasks to the draft visit | Complete visit (saves it, uses up inventory, may notify the customer) |
| Start visit (records a time; can be cleared) | Complete without notifying, create a follow-up, send any message |
| | Anything outside Randy's own assigned customers is blocked outright |

### Build effort
- Server actions plus moving the service screen onto them: medium, about 6–10 build messages.
- MCP server plus the sign-in and revoke flow: medium, about 5–8 messages. This part carries the most risk, because it needs testing with ChatGPT's connector setup.
- Testing and polish: 2–4 messages.
- **Total for Layer 2: about 13–22 build messages.** Layer 1 is roughly a fifth of that. I can't predict exact Lovable build credits, because they depend on how complex each message is and how many fixes are needed. Treat Layer 2 as about 4–6 times the cost of Layer 1.

## Ongoing AI cost per use (separate from build cost)
- **Layer 1, 30–60 seconds of dictation:** 2 AI requests (speech-to-text, then filling in the form). They are billed separately. Speech-to-text cost grows with recording length. Form-filling is a small request. Both show up in the project's AI request logs.
- **With free dictation plus the local reader:** 0 requests for routine readings, and 1 small request only when the reader can't understand the text.
- **Layer 2 "run this stop with me" session:** Charlie's own listening and thinking happen in ChatGPT and are covered by Randy's ChatGPT plan, not Lovable credits. Aqua Clear's tools are simple database actions and use no AI. So a full session costs **about zero Lovable AI credits**, unless Charlie sends raw text to Aqua Clear's AI reader. The design avoids that: Charlie sends structured values like `{chlorine: 2.5}`.
- **Other costs:** Customer texts (Telnyx per message) and emails, the same as today.
- **How to measure actual cost:** Do one realistic 45-second dictation in Preview, then check the AI request logs and your credit balance before and after. I can pull these numbers for you after the test.

## Recommendation
1. Now: test Layer 1 in the field, and optionally add free dictation to bring routine cost close to zero. This is cheap.
2. When credits allow: build Layer 2 in the order above. The server actions are worth having even without Charlie, because they make the app more reliable.

## Open questions
- Should Charlie be Randy-only at first, or available to every tech?
- Should On My Way ever send without a spoken "yes" (for example, as a per-tech setting)?
