# 0033 · Open sign-up, and Continue with Google

Date: 2026-11-16 · Decided by: Brett ("I'm okay with removing invite only. We do need to ensure that coaches can be invited to a team and be added to it.") · Ends the invite-only part of 0019; adds to 0013

## Decision
- **Anyone can create an account.** The email-first flow (0013) no longer checks the waitlist: a new email goes
  straight to Create your account. `can_create_account` stays in the database, unused, so the waitlist can come back
  without a migration.
- **Join links still join.** Signing up or in from `/join/<code>` joins that team in the same step, by email or Google,
  through `afterSignIn` as before. A join link the head coach has turned off still refuses a new account from it ("This
  join link isn't working"), since signing up through it would promise a team it can't give.
- **Continue with Google** sits under the email field on the sign-in screen and the join page, for new and existing
  coaches alike. Supabase does the OAuth (PKCE); `/auth/callback` swaps the code, takes Google's first name if the account
  has none, skips the "set a password" offer, then runs `afterSignIn`. A Google account with the same verified email as
  an existing account signs in to it (Supabase links identities). If Google is cancelled or fails, the coach is back on
  the screen they came from with "Google sign-in didn't finish".
- **The button is text only** ("Continue with Google"), in the app's secondary button style.

## Why
- The waitlist did its job for the pilot; it now stands between interested coaches and the product.
- Google removes the password-or-email-code step for most coaches; the email flow stays for everyone else.

## Not done
- The landing page still says "Get early access" with the waitlist form, and the waitlist emails still talk about early
  access. Changing those is a copy and positioning call for Brett.
- Google's own branded button (with the G mark from Google's branding guidelines) can replace the text button later.
