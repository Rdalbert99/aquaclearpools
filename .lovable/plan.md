# Karen Crago signup failure — diagnosis and safe fix

## What the logs show (verified)
- Supabase Auth log, 2026-10-23 16:55 UTC: `POST /signup` returned HTTP 500.
- Exact error: `535 5.7.8 Error: authentication failed` — the mail server **rejected the username/password** Supabase Auth uses to send email (custom SMTP in the Supabase dashboard).
- So the account was created, but the confirmation email could not be sent. The app turned this into "Error sending confirmation email".
- The log references an auth user ID for Karen (`c22811e8…`) with "confirmation requested", so an **unconfirmed** account likely now exists. I could not query user rows directly (this backend is user-managed).
- Request referer was `http://localhost:3000`, which suggests the Supabase **Site URL** is still the default. Separate issue: confirmation links could point to localhost.

## Not the cause
- Not the app's Mailjet/Resend emails (invites, password reset) — those run in app functions with their own keys. This error comes from Supabase Auth's own SMTP sender, set in the Supabase dashboard (Authentication → SMTP Settings).
- Not a rate limit (that would be 429), not a role/permission problem, not Karen's invitation.

## Safe remediation (needs your approval / your dashboard access)
1. In Supabase dashboard → Authentication → SMTP Settings, re-enter valid credentials. If it is Mailjet: username = Mailjet API key, password = Mailjet secret key, host `in-v3.mailjet.com`, port 587, sender a verified address on getaquaclear.com. (Mailjet keys may have been rotated/disabled — the app moved invites to Resend after a Mailjet 401.) Alternatively use Resend SMTP: host `smtp.resend.com`, port 465, user `resend`, password = Resend API key, sender `randy@getaquaclear.com`.
2. Set Site URL to `https://getaquaclear.com` and add it plus the preview URL to Redirect URLs.
3. Have Karen avoid signing up again; instead, once SMTP works, use "Resend confirmation" for her email. Better option: she uses her existing invitation link (valid until Oct 30), which links her to her customer record — the plain signup page would not.
4. If her unconfirmed account blocks the invitation, an admin can remove that one unconfirmed auth user in Supabase → Authentication → Users (only with your approval).

## Not done
No settings, accounts, emails or publish changed.
