# 0026 · Teams: several per coach, Team is home, Create a team

Date: 2026-10-25 · Decided by: Brett (Technical Design "Teams and discovery", `docs/specs/teams-and-discovery.md`, PR 2; canvas "Firstpass Teams & Discovery")

## Decision
- **A coach can be on several teams (one-way door D1).** `team_members` already allowed it; `join_team` no longer raises
  `on-another-team`, and a join link works for a coach who is already on a team. `create_team` makes the caller head coach
  whatever else they're on.
- **The active team is a cookie, never trusted on its own.** `fp_team` holds a team id. `requireTeam()` reads it and asks the
  store for that team *for this coach* (`myTeam(userId, teamId)`, through `team_members` and RLS); a missing, stale or forged
  id falls back to the coach's newest membership. Switching (the switcher, joining a team, creating one) sets the cookie on
  the server. Leaving or deleting a team clears it.
- **Store:** `myTeams(userId)` (newest membership first, with the coach's role) and `myTeam(userId, teamId?)`; also
  `leaveTeam`, `deleteTeam` and `saveOlderInterest`. Local mode (`store-local.ts`) does the same with join times on members.
- **Group names per team and 1 to 3 groups (one-way door D2).** The three slots stay the internal keys (Sharks, Bears,
  Eagles, easiest to hardest) that plans, drills, attendance and check-ins store. Each entry in `teams.groups` may carry a
  `name` (default: the slot) and `off: true` (0 skaters). Every screen reads names through `groupLabel(team, slot)`; today's
  units carry them as `label`/`names`, so plans, Today, print and the parent link follow. An off group is absent everywhere:
  `todayUnits`, attendance, merges, "ready for harder" and suggestions. A team keeps at least one group. **A fourth group is
  deferred** (half ice has three station zones): "Add a group" stops at 3 with "3 is the most for now".
- **Team is first in the nav and is home.** Signed-in coaches landing on `/` go to `/team`, except a phone on a practice day,
  which opens `/today` (user agent, not screen width: the server decides before anything paints). The team switcher sits
  under the logo in the rail and the phone drawer: the coach's teams, then **Create a team**.
- **`/team` reads; each section edits in a drawer.** Next practice, practices and ice, skill groups, coaches, gear, planning,
  the join link, season so far and parents, with leave (coaches) or delete (head coach, type the name) at the bottom. Each
  Edit opens one drawer (a bottom sheet under 1024px) that saves only that section with the existing `saveTeam` action; the
  calendar and coaches drawers reuse their existing components.
- **`/team/new` is Create a team, one question per screen:** Name → Copy settings (only with another team) → Age → Ice
  times → Skill groups → Coaches → Gear (skipped when gear is copied) → Focus → Check and build. Progress reads
  "3 of 8 · Age group". Each screen starts with a guess and says why (the name says U9; like your Avalanche; the calendar
  says the ice is shared). Building creates the team (head coach), sets the cookie, connects the calendar, emails the
  invites with the join link, builds the first practice the way decision 0023 does (`src/lib/plans/start-plan.ts`, shared
  with Plans) on the first ice time or the usual guess, and opens it.
- **U11 or older is not a dead end.** The age screen's "U11 or older" opens a short screen that saves `older_team_interest`
  (age, hardest part, happy to chat) and offers "I coach a younger team too". "No kids' names, please." under every free
  text field and the group names.
- **Teams gain `gear` (jsonb counts) and `focus` (text[], up to two)** for the Team page and the wizard.

## Handing over a team
- A head coach can make another coach **already on the team** head coach (Coaches drawer → Make head coach, with a confirm:
  "Kara becomes head coach. You stay on the team as a coach and can leave after."). `hand_over_team(team, new_head)` swaps
  both roles in one statement, so a team always has exactly one head coach; it raises `not-head-coach` or `not-on-team`
  (no handing a team to a stranger: invite them first). The team, its plans and its history stay.
- The new head coach gets an email ("Brett made you head coach of U7 Clippers": what they can now do, and a button to the
  team), `headCoachEmail` in `src/lib/email/account-emails.ts`. It needs registering in PR 3's journey registry.
- At the bottom of the Team page a head coach with other coaches sees "Hand the team to another coach first", which opens
  the Coaches drawer; after handing over, Leave is there. The only coach on a team can only delete it.
- Coaches who leave keep their first names on past check-ins and edits (stored as text with each row; team data, no kids'
  data), and counts never go below zero.

## Why
The bet is whether coaches keep using Firstpass: a coach making a second team, or a U9 team signing up, is the strongest
signal, and the one-team rule blocked both. The team is what a volunteer coach thinks in, so it's the home page; reading
first and editing one section at a time keeps it calm for novices (decision 0024's lesson).

## Migration
`supabase/migrations/20261028000000_multi_team_and_older_interest.sql` (safe to run twice): `join_team` and `create_team`
replaced, `leave_team`, `hand_over_team`, a head-coach delete policy on `teams`, an index for newest membership, `teams.gear` and
`teams.focus`, and `older_team_interest` with RLS (insert own row; select own row or admin). Before it runs the app still
works: joining a second team shows "try again tomorrow", leaving explains what to run, gear and focus aren't saved.

## Not done
- A fourth skill group (see above).
- Ice times typed by hand in Create a team (no calendar link: plans take a date each time, as today).
