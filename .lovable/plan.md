# Karen Crago login failure — diagnosis (read-only) and proposed fix

## Evidence
- Auth logs (last 3h): only two `/signup` requests (17:26:40, 17:28:27 UTC), both 200 with `user_confirmation_requested` for the same auth user. So SMTP now works and the second signup just re-sent confirmation — no duplicate account.
- No sign-in (`/token`) requests at all. Her login attempts never reached Supabase Auth, so this is NOT a wrong-password error.
- Her email is not confirmed yet (no confirmation/verify event in logs).
- No `public.users` profile row exists for her auth ID. The signup page tries to write it before she has a session (confirmation required), so it is silently blocked.
- The login page asks for a **username** and looks it up via `get_email_by_login`. With no profile row (and the signup form never asks for a username — it would auto-generate one like `karencrago1792...`), the lookup fails and the app shows "Invalid username or password" before contacting Auth.
- Signup referer is `http://localhost:3000` → Site URL still wrong; confirmation link may point at localhost.
- Customer linking can't run yet: it requires a confirmed email and a profile.

## Verdict
Not a failed password, not a duplicate account. Two blockers: (1) email unconfirmed, (2) app cannot resolve her to a username, so login can't even be attempted.

## Next safest actions
1. You (Supabase dashboard): set Site URL to `https://getaquaclear.com` and add redirect URLs; ask Karen to click the newest confirmation email (resend only if the link points to localhost, after fixing Site URL).
2. Code fix (needs your approval, preview first):
   - Login accepts an email address too: if input contains `@`, sign in with it directly; otherwise use username lookup.
   - Create the profile on first confirmed sign-in (existing `ensureProfile` already does this) — then the verified-email auto-link runs.
   - Signup form: let customers pick a username (or tell them to sign in with their email).
3. Re-check logs after Karen confirms and signs in.

No reset, resend, config, customer change, or publish was performed.
