# 0039 · The first plan leans toward the team's focus

Date: 2026-11-19 · Decided by: Brett ("I do like the idea of a new sign up having a practice immediately … The plan
would need to meet their goals." Then "Yes" to the proposal below.)

## Decision
- Create a team asks "What do you want to work on first? … Plans lean that way", but the first plan (decision 0023)
  ignored the answer. `firstPlan()` now takes the team's focus. **It tilts the plan, not rebuilds it:**
  - The **rotation** prefers a drill whose main focus is a picked skill.
  - The **skill drill** prefers the pick the rotation didn't cover.
  - The **game** leans toward the focus only when that wouldn't make a third drill in a row on one skill (the
    variety check, decision 0008).
  - Free skate, the warm-up, water and the huddle don't change. With no focus, or nothing in the library for a pick,
    the plan is exactly what it was.
- A block picked for the focus says so in its note: "Works on Passing, your team's focus." The coach sees their
  answer was used and can delete the note like any other.
- Live drills only, as before (`libraryDrills()`).

## Limits found (2026-11-19, live U7 library)
- **Passing:** no live U7 drill the first plan can use, so a Passing pick doesn't change the plan yet.
- **Game sense:** only the game (Ice Soccer) can lean that way.
- No live U7 warm-up qualifies (the only one, Skill Doctor Tag, is Hard), so first plans have no warm-up drill, and
  the leftover time becomes a long scrimmage (about 19 minutes at 60 minutes). Both pre-date this change.
