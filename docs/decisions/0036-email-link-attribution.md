# 0036 · Which update email links bring coaches back

Date: 2026-11-18 · Decided by: Brett ("can we track which email links result in a new session or activity in the
app?" … "yes, i want to see session attribution")

## Decision
- **First-party link tags, not Resend click tracking.** Every firstpass.coach link in an email from Admin → Send
  (text links, linked images, buttons; never the opt-out) gets `?from=<ref>-<n>`: the email's 8-character ref
  (`broadcasts.ref`) and the link's number in reading order. Links to other sites aren't touched. Previews and test
  sends aren't tagged. Resend open and click tracking stay off.
- **A click is a session from the email.** Signed in: the middleware calls `record_email_click` before any page can
  redirect, then sends the coach on to the same page without the tag. Signed out on a page that needs sign-in: the
  tag rides through sign-in in `next`. Signed out on an open page (the home page): `EmailClick` in the root layout
  takes the tag off the address bar, keeps it in the tab and retries on each page change until they're signed in.
  Only email tags are touched; other `?from=` values (share, invite, shared ice) are the visit tracker's. One click
  per coach, email and link per 10 minutes, and only from coaches it was sent to. No cookies.
- **What happened next**, per email, on its Admin → Send page (`broadcast_stats`, Brett only): coaches who came back
  from each link, and for coaches who clicked and didn't, how many planned or edited a practice, checked in, or scored
  progress (not "opened a practice": practice_views keeps only each coach's latest view, so it would shrink) in the 7 days after their first click (or after it was sent). Only coaches it was sent to
  count, so admins and forwards don't.
- Fixes after review: `20261125000000_email_attribution_fixes.sql`.
- Privacy page: links carry a tag so Brett can see which email brought you back.

## Limits
- A coach who opens the link signed out and signs in on another device isn't counted.
- Clicking and not clicking aren't random groups: coaches who click were often coming back anyway. The comparison is a
  signal, not proof.
