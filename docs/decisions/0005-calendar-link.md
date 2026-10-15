# Decision: Ice times from the team's calendar link
Status: Accepted · 2026-10-14

## Context
Teams get their ice times from TeamSnap (or Google Calendar, or an association feed). Coaches shouldn't type dates twice, and moved ice times should move the plan. Brett's U7 C6 Clippers export showed the real titles:
- Practices are "Practice", including a typo ("Practicd").
- Games are "at NANAIMO MHA (1) U6/U7 'C'3 CLIPPERS".
- Jamborees, the photo day and fundraisers are also in the schedule.

## Options
| Option | Time to launch | Monthly cost | Lock-in | Future-proofing | Key risk |
|---|---|---|---|---|---|
| A. iCal link per team, read on the server when a coach opens Plans (at most hourly), as the coach | Days | $0 | None (any iCal feed) | Add a daily cron later | A schedule change shows up only when someone opens Plans |
| B. Daily Vercel cron reading every team's link | Days | $0 (Hobby: 1/day) | None | Ready for reminders | Needs the service-role key in `src/`, which we ruled out |
| C. TeamSnap API integration | Weeks | $0 | TeamSnap only | Rosters too (which we don't want) | OAuth, partner approval, child data nearby |

## Decision
A.
- `teams.calendar_url` holds the link. The head coach sets it on the Team page.
- `ice_times` holds one row per calendar event UID: date, start, minutes, rink, title, kind (practice, game or other), the other team, cancelled, ignored, and the plan made from it. RLS is by team membership.
- **Kept:** dates, times, rinks and event names. **Never kept:** descriptions, attendees and addresses.
- **What shows in Plans:**
  - Practices show with **Plan it**.
  - Games show with **Plan anyway**.
  - Other events stay out.
  - **Not ours** hides any of them.
- **When the calendar changes:**
  - A moved ice time moves its plan (unless the plan is Done) and says "Moved from …".
  - An ice time that leaves the calendar shows "Cancelled in the calendar" on its plan.
- **Fetch safety:** only http(s) links to public hosts are read, and http is upgraded to https. Redirects aren't followed. The read has an 8 s timeout and a 2 MB cap.

## Consequences
- Run `supabase/migrations/20261016000000_calendar.sql`.
- Times use the server's time-zone rules for America/Vancouver. Check the first real feed's November practices: they fall after the DST change.

## Revisit when
Coaches need reminders before practice (then add the cron and a scoped server key), or a second calendar source needs special parsing.
