# Decision: Rotate, Skill groups, Together
Status: Accepted · 2026-11-20 (Brett, from the canvas "Firstpass planning changes")

## Context
Decision 0024 named how a drill is run: Everyone rotates, Split by skill, Whole group. Those names only showed in the plan builder. The library, the drill page and the drill drawer still said Basic, Stations and Rotation, and the public pages called both rotations and skill-group drills "stations".

## Decision
- **"Station" is a place on the ice.** The label says who moves:
  - **Rotate** (rotation): everyone moves. A different drill at each station.
  - **Skill groups** (stations): everyone stays. The same game at each station, easier or harder.
  - **Together** (basic): everyone does one drill. Levels, when it has them, step the whole team up.
- One word and one icon (circular arrows, three lanes, a group of people) on every drill and block a coach sees: library cards, the drill page and drawer, the picker, plan blocks, Today, the printout, and the drill request form. The labels and icons live in `src/components/drill-format.tsx`.
- The data model keeps its names (`rotation`, `stations`, `basic`). Only the words change.

## Settled since
A Skill groups block never runs a drill's levels, and level chips are built (decision 0049).
