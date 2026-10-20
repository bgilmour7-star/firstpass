# 0018 · Coaches request drills; Claude drafts them once a day; an admin decides

Date: 2026-10-20 · Decided by: Brett

## Decision
- **Request a drill** (Drills page, and "Request it" when a search finds nothing): a sheet with Describe it
  (required, "No kids' names, please"), an optional link, Part of practice, Shape, Works on (up to 2) and minutes.
- **Suggest a change** (drill page and drill drawer): one text box, opened in place.
- Both become a row in `drill_requests` (RLS: coaches create and read their own team's; admins all). At most
  **5 open per team**. The coach sees "Sent. Claude drafts it by tomorrow morning, then it's reviewed." and a
  "Your team's requests" list on Drills with each one's state in plain words.
- **Once a day** a scheduled Claude run works them with the drill-requests skill: a new drill is written and drawn
  (rink-diagram skill) and goes in **In review**; a change is stored as a **proposal** beside the live drill, which
  doesn't change until accepted. Requests it can't draft get a note instead.
- **Brett is emailed** when a draft is ready (the check-in email timer sends it; the address is
  `private.settings.review_email`, else the first admin). Drill review shows a "From coaches" list and the nav's
  Drill review item shows how many drafts are waiting.
- **Deciding:** a requested new drill is answered from Drill review: making it live accepts it, archiving it (with
  the reason) declines it. A change has its own page (`/admin/requests/<id>`): live vs proposed, field by field and
  diagram beside diagram, with Accept or Decline and a reason. Either way **the coach gets an email** with the outcome.

## Why
Brett: coaches should be able to ask for drills and improvements; "Claude creates drill and put it under review for
me. Notification badge shows +1. Notify me by email." Once a day is enough while Brett reviews everything anyway, and
a scheduled run can render and look at each diagram before it lands.
