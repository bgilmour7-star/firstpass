# Decision: The check-in email, 30 minutes after practice
Status: Accepted · 2026-10-18 (Brett: "yes" to the proposal, Resend chosen for its free tier)

## Context
The after-practice check-in (0007) feeds the warnings, the drawer and the variety check (0008), so it only works if coaches do it. The agreed design (design-decisions log, 2026-10-12) is one notification 30 minutes after practice ends, while it's fresh, and no second reminder. Firstpass now sends from `hello@firstpass.coach` through Resend (free: 3,000 emails a month, 100 a day).

Finding who is due needs every coach's email address, which lives in `auth.users`. The app never holds the service key (CLAUDE.md), so the app can't read those addresses itself.

## Options
| Option | Time to launch | Monthly cost | Lock-in | Future-proofing | Key risk |
|---|---|---|---|---|---|
| A. Database timer (pg_cron + pg_net) every 10 min calls `/api/cron/checkin-emails`; a security-definer function, guarded by a secret kept in a private schema, picks and claims the due emails; the route sends them through Resend | Hours | $0 | Low: plain SQL and one HTTP call | Same pattern serves any later reminder | The timer lives in the database, out of sight of the repo; documented in the migration and setup |
| B. Vercel cron | Hours | $0 on Hobby, but only once a day | Low | Needs Pro ($20 USD/month) for every-10-minutes | Emails arrive hours late on Hobby |
| C. Schedule each email in Resend when a practice is saved | Days | $0 | Medium: Resend's scheduling | Must reschedule on every time change, every coach added, every check-in | Emails sent for moved or cancelled practices |
| D. Give the app the service key | Hours | $0 | Low | Weak: breaks the rule that `src/` never has it | One leaked key reads every team |

## Decision
A.
- **Who and when:** each coach on the team whose practice (with at least one block) ended 30+ minutes ago and less than 6 hours ago, who hasn't checked in, hasn't been emailed about it, and hasn't turned the email off. The 6-hour window means turning this on, or a long outage, never sends emails about old practices. Times are Vancouver time, like the rest of the app.
- **One email per coach per practice,** recorded in `checkin_emails` when claimed, so overlapping runs can't double-send. A failed send is handed back and retried on the next run.
- **What it says:** "How did Tuesday's practice go?", "About 20 seconds. Your answers shape Thursday's plan.", a Check in button to that practice's check-in, which co-coaches have already checked in, and a link to turn it off. No kids' names (there are none to include).
- **Each coach sets their own:** "Email me after practice" on the Team page (`team_members.checkin_emails`, changed only through `set_checkin_emails`, for yourself).
- **Not yet:** a nudge to coaches who haven't checked in, or a second reminder (deliberately none).
