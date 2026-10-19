# Decision: Co-coaches join through a team join link
Status: Accepted · 2026-10-18 (Brett: "yes" to the pilot-sized version)

## Context
Firstpass is built for several coaches per team (check-ins side by side, who changed a plan, "Kara has checked in already"), but there was no way for a second coach to join: the build plan left invites for onboarding (Milestone 2). Worse, a co-coach who signed in was asked to "Name your team" and would create a second team. And because the sign-in email lands on drill review, a coach who isn't an admin hit "Admins only".

## Options
| Option | Time to launch | Monthly cost | Lock-in | Future-proofing | Key risk |
|---|---|---|---|---|---|
| A. One join link per team, head coach turns it on, replaces or turns it off; Coaches list with Remove | Hours | $0 | Low | Email invites can be added on top later | A forwarded link lets someone unintended join; the head coach sees them in the list and can remove them and replace the link |
| B. Email invites to a named address | Days | $0 (Resend) | Low | The usual SaaS pattern | Address mismatches (invited one email, signs in with another); more screens |
| C. Admins add coaches by SQL | Minutes per coach | $0 | None | None | Doesn't scale past Brett |

## Decision
A.
- **Join link:** `/join/<code>`, a random 24-character code on `teams.join_code`. Only the head coach can turn it on, make a new one (the old stops working) or turn it off. Coaches already on the team stay when the link changes.
- **Joining:** anyone signed in can see which team a link is for, then press Join. Signed-out visitors sign in first; a cookie remembers the link through the email round trip and brings them back to it.
- **One team per coach** during the pilot. Someone already on another team is told so instead of joining.
- **Coaches list** on the Team page: email, role, "(you)". The head coach can remove a coach (with a confirm step), never themselves.
- **"Name your team"** now says to use the head coach's join link if you're joining an existing team.
- **Coaches who aren't admins land on their plans** instead of "Admins only" when the sign-in email points at drill review.
- All changes go through security-definer functions that check the role (`new_join_code`, `turn_off_join_code`, `join_code_team`, `join_team`, `team_coaches`, `remove_coach`); emails come from `auth.users` only for members of the same team.
- **Later (Milestone 2):** emailed invites, changing roles, coaches on several teams, association admins.
