# Decision: Level chips, and a drill has levels or skill-group versions, never both
Status: Accepted · 2026-11-21 (Brett, from the canvas "Firstpass planning changes")

## Context
Not every drill deserves a progression. A coach needs to see at a glance which ones do, without drills that have none looking unfinished.

## Decision
- **Chips, like colour swatches on a product.** A drill with levels shows small `1 2 3` chips beside "Together" on library cards, in the drill picker and on plan blocks. A drill without levels shows no chips. Filled chips are the levels in use: the ones switched on in a plan block, or where an age group starts.
- **The drill page has a level switcher.** Level 1 / 2 / 3 buttons swap one rink diagram and its "Adds" line, in place of every level's diagram side by side.
- **A drill has levels or skill-group versions, never both.** They look alike but do different jobs. Levels are a Together drill's steps: the whole team does them in turn (decision 0006 stands). Skill-group versions run at the same time, one per group, each at its own station. A Skill groups block never runs a drill's levels.
- Chips and labels live in `src/components/drill-format.tsx`; the switcher is `src/components/level-switcher.tsx`.
