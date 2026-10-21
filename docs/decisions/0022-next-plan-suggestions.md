# 0022 · Suggestions on the next plan from the check-in

Date: 2026-10-20 · Decided by: Brett (mockups "Next-Plan Suggestions")

## Decision
- **Rules, no AI** (`src/lib/plans/suggest.ts`). The check-ins on the practice just before a plan (within two weeks) turn into
  at most three suggestions on that plan, each on the block it's about:

  | What the check-in said | Suggestion |
  |---|---|
  | A group was ready for harder | Add the next level to **one** drill the kids know, the one they've done most |
  | Flopped: too much waiting | Swap for a drill with the same Main skill where everyone moves |
  | Flopped: too hard | Turn off its top level, else swap for an easier drill |
  | Flopped: too easy | Add its next level, else swap for a harder drill |
  | Flopped: confusing setup | Swap for a drill the kids know |
  | Got bored from a drill (no flop) | A fun game before it |
  | Got tired from a drill | A water break before it |
  | Big hit | Never suggested away; listed as staying |

  Only where the coaches agree (a split gives none). A swap names one drill: same block kind, part and Main skill, within
  2 minutes, not flopped in six weeks, Big hits first, then drills the kids know. If nothing fits, the box offers the drawer.
  Flops come first; lost steam on a flopped drill is part of that flop's suggestion. Rotation zones aren't handled yet.
- **Nothing changes until a coach taps.** The box (dashed whistle orange, like the variety check) says whose answers it
  comes from, what happened and what to do, with fixed-label buttons: Add Level 2 / Swap it in / Other drills / Keep as is.
  It replaces the drill's feedback line while it's open; a level suggestion also tags the level card "Suggested".
- **After a tap**, a line on the block says what changed with **Undo** (this visit only), and the change goes through the
  normal plan save, so the edit log records it. Suggestions are worked out from the plan as it is, so a handled one stops
  appearing.
- **Keep as is hides it for every coach on the team** (`practice_suggestions_kept`, RLS by team), and the margin says who
  kept it.
- **The margin** gets a "Saturday's check-in" section: what's left to look at (linking to each block), what's done, what was
  kept, and the Big hits that stay. **Phones** get one line at the top of the plan. A variety warning that a suggestion would
  clear says so. The check-in summary says the answers will show up as suggestions on the next plan.

## Why
Check-ins already produced warnings, but the coach still had to work out the fix. Brett: rules first, no AI yet; one level at
a time keeps drills familiar; a kept suggestion shouldn't come back for the co-coach.

## Not done
- AI suggestions (the next build-plan item, through one module, building on these rules).
- Suggestions inside rotation zones; suggestions on plans other than the next one; anything applied without a tap.
