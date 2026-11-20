# Spec: every practice arrives planned, with stations for the coaches you have

Date: 2026-11-20 · Decision 0046 · Asked for by Brett: the promises on the public site and in Create a team are
"actually the next feature we need to work on, before association views and capabilities."

## The promises, and what the app does today

| Promise (where) | Today |
|---|---|
| "More coaches on the ice means more stations" (Create a team) | `team.coachesOnIce` is saved and shown, never used. Rotations run one station per skill group (`rotationToday`). |
| "Every practice arrives planned" (landing, `/u7` hub) | Only the first plan is automatic (decision 0023). After that a coach taps "Plan it" or "Add a practice". |
| A version of each drill for each skill group (landing) | 19 of 54 live drills have levels. Rotations (9) and "together" drills (4) have none; station drills (3) have one per group by design. |

## Decisions (Brett, 2026-11-20)

1. **Stations = coaches on the ice; groups double up.** A rotation runs no more stations than there are coaches.
   - 2 coaches, 3 groups: 2 stations, and the two groups closest in level share one.
   - 1 coach: no rotation. A new plan uses a game or an everyone drill instead, and an existing rotation block gets a warning on the block with a suggested swap.
2. **The next practice is planned automatically**: right after a coach finishes the check-in (so it uses the suggestions), or the day before practice if nobody checks in.
3. **A version per skill group is drill-library work, alongside this**, through drill review, not planner code.

## How it works

### A. Stations follow the coaches (PR A)
- `rotationToday(block, groupCount, coaches)` runs `min(stations, groups, coaches)` stations, at least 1.
- **Doubling up.** When there are more groups than stations, the rotation's units are merged, using the same merge as attendance (`todayUnits`), until there are as many units as stations.
  - The pair merged is the two adjacent groups (by level) with the fewest skaters together, so the shared station stays small.
  - Each merged unit is labelled "Bears + Sharks" on the plan, the rink-side page, the printout and the parent link.
- **Coaches today.** A practice can override the team's number in "Who's here" (`attendance.coaches`, optional, defaults to `team.coachesOnIce`). A coach who can't make it is the most common reason for a different number.
- **New plans:**
  - `firstPlan` takes the coach count. With 1 coach it skips the rotation and fills the time with the skill drill and a second game.
  - A copied plan keeps its blocks and the rotation adapts on the day.
- **1 coach and a rotation block:** the block shows "1 coach on the ice: this rotation needs 2. Swap for an everyone drill?" with Swap it in / Keep as is, in the same dashed whistle-orange box as other suggestions. It is suggested, never applied (UX patterns).
- Create a team already asks who coaches with you (`coachesOnIce = 1 + invites`), so nothing changes there.

### B. The next practice plans itself (PR B)
- **Which practice:** the team's next practice ice time from the calendar with no plan (`nextPracticeDate` rule 1).
  - Teams with no calendar get the rule-2 guess (a week after the last plan, same start), marked on the plan as "Date guessed from your last practice. Change it if it's wrong."
- **When:**
  1. **After the check-in.** When a coach finishes a check-in, the next practice is planned in the same server action, in the coach's own session. The check-in summary says "Thursday's plan is ready" with a link.
  2. **The day before.** When anyone on the team opens Today, Plans or Home and the next practice is within 36 hours with no plan, it's planned then.
     - This is lazy rather than a timer job, so no new privileged path is needed: the service-role key stays out of `src`, and the DB timer can't build a TypeScript plan.
     - A "your plan is ready" email the day before is a later step. It would need the plan to exist first, so it would move this onto the timer.
- **What:** the same `startPlan` as "Plan it": a copy of the last plan, with the check-in suggestions showing on it, nothing applied without a tap (decision 0022).
- **Who made it:** the edit log says "Firstpass planned it from Saturday's practice", attributed to the coach whose action triggered it.
- **Never twice:** a unique `(team_id, date, start_time)` guard on practices, or the ice time's `practice_id` link, prevents a second plan when two coaches open the app at once. Check the existing schema before choosing; a migration needs the full SQL in the PR.
- **Turning it off:** none for now. Every coach can still delete or change a plan. Add a team setting only if a coach asks.

### C. Versions per skill group (library track, alongside)
- Draft Level 2 and 3 for the 18 live basic drills without levels, most-used first, through the drill-requests and rink-diagram skills. Status: In review, Brett and the head coach approve.
- Rotation zones having levels is a separate, bigger change (decision 0022 "not done"). Not in this spec.

## Order
1. PR A: stations follow the coaches (pure functions and tests first, then the plan, rink-side page, printout and parent link).
2. PR B: the next practice plans itself.
3. Then restore the stronger claims on `/associations`, the stations page and the comparison page: stations for the coaches you have, every practice planned.

## Tests
- `rotationToday`: 3 stations, 3 groups, 2 coaches → 2 stations; 1 coach → 1; doubled units are adjacent and the smallest pair.
- `firstPlan` with 1 coach has no rotation and still fills the minutes.
- Next practice: planned once after a check-in, once on open within 36 hours, never twice; a past or cancelled ice time is never planned.

## Risks
- **Plans the coach didn't ask for.** A plan appearing on its own could surprise a coach who plans on paper. The edit log line and "Firstpass planned it" make it clear, and deleting is one tap.
- **Doubled-up groups at one station** have twice the kids for one coach. That's the honest outcome with fewer coaches, and the plan says so on the block.
