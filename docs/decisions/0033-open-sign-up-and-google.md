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

## The public site (Brett, 2026-11-16: "we need to update these flows now")
- **Every call to action is "Plan your first practice"**, straight to sign-in (Google or email), in the hero, the
  sticky header ("Get started" on phones) and the closing band. "Your first team is free. Sign up with Google or your
  email." under it.
- **The hero line names the pain coaches gave in the survey** (keeping kids engaged): "every group busy, every drill at
  the right level, and the whole plan on your phone at the rink".
- **A progress section, "See them get better."**, after the check-in loop, with the real progress chart on example
  numbers. It's a section, not the headline: in the pilot, 2 rounds were opened and 1 coach scored, so there's no
  evidence yet that coaches choose Firstpass for it. Revisit when pilot coaches have scored twice and said whether it
  changed their next plan.
- **Associations keep a form** ("Run an association?", email, association, number of teams, "Talk to Brett"). Rows still
  go to the waitlist table and alert hello@firstpass.coach. The coach path of the form is gone.
- **The waitlist survey series is retired** (welcome, nudge, last ask skip as `retired`). The survey thank-you links to
  sign-up instead of "You're still on the waitlist".
- **Analytics funnel:** Visited → Tapped Plan your first practice (`form_start`) → Made a team → Made a plan. The last two
  are counted in the app, not linked to visits.

## Sign-up page (Brett, 2026-11-18)
- **"Plan your first practice" goes to `/signup`, not `/login`.** Brett: the button "links to the sign in page, not the
  create an account page". `/signup` is the same email-first flow and Google button, headed "Create your free account"
  with "Your first team is free". An email that already has an account still goes to Welcome back. The survey
  thank-you links there too. "Sign in" in the header and footer stays on `/login`.

## Follow-up
- The sign-up email journey, Leads tab and new-account analytics: decision 0034.
