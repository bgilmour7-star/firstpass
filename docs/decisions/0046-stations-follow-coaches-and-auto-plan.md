# 0046 · Groups today follow the coaches; say what changes; one team setting; the next practice plans itself

Date: 2026-11-20 · Decided by: Brett. Spec: `docs/specs/every-practice-planned.md`. Canvas: "Firstpass planning
changes".

Brett: the promises on the public site and in Create a team ("More coaches on the ice means more stations",
"every practice arrives planned") are "good. It's actually the next feature we need to work on, before association
views and capabilities." Then: "instead of asking which groups to merge, just say reduce to 2 groups, as they will
likely need to keep the number of kids balanced", and "we need to be more transparent with what is going to happen
after the coach updates the who's here today or when they checkin".

## Decision
- **"Groups today" sets the stations.** Who's here today has skaters per group, Coaches, and Groups today (3 · 2 ·
  1). Fewer coaches suggests fewer groups ("2 coaches, so 2 groups. Split the 12 kids into 2 even groups."). The
  coaches rebalance the kids on the ice. The app joins the neighbouring pair with the fewest skaters
  (`reduceUnits`), so drills with levels start a joined group at the easier level, like a merge. The pair-merge
  switches are gone; old merges still load.
- **One team setting, "When something changes"** (`teams.planning`, head coach only, default `auto`):
  - **Update the plan for us:** applying Who's here updates the plan, and a line says what changed, with Undo and
    "Use the N minutes". A team with fewer coaches than groups skates one group per coach by default.
  - **Ask me first:** Who's here offers Update the plan / Save, keep the plan / Cancel. Kept plans keep their zones;
    the rotation says "3 zones, 2 coaches today. One zone has no coach." with Run 2 zones / Keep 3.
  - Every screen that acts on its own says which setting caused it and links to Team settings.
- **First plan with 1 coach:** no rotation, a second everyone-game instead.
- **The check-in end says what happens next, and the next practice plans itself** (PR B): with "Update the plan
  for us", right after the check-in ("Thursday's plan is ready", Open / Undo); with "Ask me first", Plan Thursday
  now / Not yet. Either way, if nobody plans it, Firstpass plans it the day before. Suggestions are never applied
  without a tap.
- **Versions per skill group** stay drill-library work, through drill review.
- No AI: groups today is arithmetic, and the next plan is the last plan plus the rule-based check-in suggestions
  (decision 0022).

## Not done (yet)
- The parent link counts coaches only when the practice sets its own number.
- PR B (the check-in end and the next practice planning itself).
