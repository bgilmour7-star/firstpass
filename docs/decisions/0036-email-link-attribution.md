# 0036 · Which update email links bring coaches back

Date: 2026-11-18 · Decided by: Brett ("can we track which email links result in a new session or activity in the
app?" … "yes, i want to see session attribution")

## Decision
- **First-party link tags, not Resend click tracking.** Every firstpass.coach link in an email from Admin → Send
  (text links, linked images, buttons; never the opt-out) gets `?from=<ref>-<n>`: the email's 8-character ref
  (`broadcasts.ref`) and the link's number in reading order. Links to other sites aren't touched. Previews and test
  sends aren't tagged. Resend open and click tracking stay off.
- **A click is a session from the email.** `EmailClick` in the root layout reads the tag on any page, takes it off the
  address bar, and calls `record_email_click` for the signed-in coach (one per coach, email and link per 10 minutes).
  Signed out, the middleware carries the tag through sign-in (`next=/path?from=…`), with sessionStorage as a backup in
  the same tab. No cookies.
- **What happened next**, per email, on its Admin → Send page (`broadcast_stats`, Brett only): coaches who came back
  from each link, and for coaches who clicked and didn't, how many opened a practice, planned or edited one, checked
  in, or scored progress in the 7 days after their first click (or after it was sent). Only coaches it was sent to
  count, so admins and forwards don't.
- Privacy page: links carry a tag so Brett can see which email brought you back.

## Limits
- A coach who opens the link signed out and signs in on another device isn't counted.
- Clicking and not clicking aren't random groups: coaches who click were often coming back anyway. The comparison is a
  signal, not proof.
