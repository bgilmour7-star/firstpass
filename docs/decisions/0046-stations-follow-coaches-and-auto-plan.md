# 0046 · Stations follow the coaches on the ice; the next practice plans itself

Date: 2026-11-20 · Decided by: Brett. Spec: `docs/specs/every-practice-planned.md`.

Brett: the promises on the public site and in Create a team ("More coaches on the ice means more stations",
"every practice arrives planned") are "good. It's actually the next feature we need to work on, before association
views and capabilities."

## Decision
- **A rotation runs no more stations than there are coaches on the ice.** With fewer coaches than groups, groups
  double up: the neighbouring pair with the fewest skaters shares a zone (`rotationUnits`, `stationsToday`).
  - 1 coach: one zone, everyone together. A new team's first plan has no rotation; a second game takes its place.
  - The rotation block says who shares a zone, on the block (dashed whistle orange). Nothing is applied for the coach.
- **Coaches today:** "Who's here today" has a Coaches stepper (`attendance.coaches`, optional). It defaults to the
  team's number and is for this practice only. Times, the rink-side page, the printout, the check-in and Home all
  count stations this way.
- **Every practice arrives planned** (PR B): the next practice is planned right after a check-in, or when anyone on
  the team opens the app within 36 hours of an unplanned practice. It's the same copy-and-suggest as "Plan it".
- **Versions per skill group** stay drill-library work, through drill review.

## Not done (yet)
- The parent link counts coaches only when the practice sets its own number. The shared-practice function doesn't
  return the team's coach count (a migration, later).
- Station drills ("Split by skill", one station per group) don't double up yet. Only rotations do.
- PR B (the next practice plans itself).
