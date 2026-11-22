# Decision: Leads and returning visitors, and a formal lead funnel
Status: Accepted · 2026-11-22 (Brett)

## Context
Admin → Analytics counted every visitor the same, so coaches already using the app (opening the site to sign in, reading an answer page) inflated "visitors" and diluted every conversion rate. Brett wants leads and returning visitors apart, and the funnel's drop-off at each step.

## Decision
- **Each visit records whether the visitor was signed in** (`page_events.signed_in`), and sign-ins record themselves: `sign_in` for an existing account, `account_created` for an account under an hour old (path `/signup`, or `/join` from a team invite). Recorded from `afterSignIn`, so every sign-in path counts. Only *whether*, never *who*: no user id or email in `page_events`.
- **Returning** = a visitor id (one browser, one day, decision 0019) that was signed in on any event, signed in, or made an account from an invite. **Everyone else is a lead.** A lead who makes their own account stays a lead that day: that's the conversion.
- **The lead funnel** has two parts. On the site, each step is the leads from the step before who went on to do it, the same visitor on the same day: Visited → Reached the sign-up section → Tapped Plan your first practice → Made an account. In the app, counted there and not linked to visits: New accounts, not invited → Made a team → Ran a practice and checked in. Each step shows its count, what it kept from the step before and how many dropped; the biggest site drop is marked. Drop-off is never computed across the two parts.
- Pages and channels show leads and returning side by side; taps are leads' only.

## Limits
- Same day, same browser only (no cookies). A lead who visits Monday and signs up Wednesday shows as an untraced account; so does a magic link opened in an email app's own browser.
- Events from before this change have no flag, so they all count as leads.
- In the app part, a step can be bigger than the one before (a test team, a coach making a second team); it reads "N more than the step before", not a percentage. "Invited" counts invited sign-ins by daily visitor id, so it can be off by one.
- Like the old recording function, `record_site_event` is open to anyone, so someone could post fake events. The site's own client only sends view, reached_form and form_start.
