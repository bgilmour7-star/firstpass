# 0008 — Feedback on the drill, and the variety check

Date: 2026-10-18 · Status: accepted

## Context
Check-ins (0007) tell us which drills flopped, which were Big hits and where the kids lost steam. Coaches need that when they plan the next practice, and Brett's experience is that U7s get bored or tired when one kind of thing runs too long. We want this without AI for now.

## Decision
**Two drill tags**, set by admins in drill review and stored in the drill content (no schema migration):
- `effort`: easy · medium · hard.
- `format`: everyone (everyone moves) · groups (small groups) · line (one at a time).

**Feedback lives on the drill**, wherever a coach meets it again: the plan block and the add-a-drill drawer card. One line, from check-ins at earlier practices:
- "Flopped Oct 14 · too much waiting (Kara)" or "got bored from here" → warning tone.
- "Big hit ×2 · last Oct 16" → good tone, a heart, and a "Kids loved it" drawer filter.
- Coaches disagreeing (or rotation zones disagreeing) → "Mixed".
- Nothing in six weeks → faded and no longer a warning.
The drawer sorts Big hits first and warned drills after the rest. Nothing is hidden or changed automatically.

**The variety check** warns inside the third block in a row (the limit is two) that is:
- **Hard** — any break (water, huddle, free skate, small games) resets it.
- **A skill drill with no game** — a drill whose part is not Fun game and whose format is not Everyone moves. A game, an everyone-moves drill, free skate or small games reset it; water and huddle don't.
- **The same Main skill** — a different Main skill, free skate or small games reset it.
Empty blocks neither count nor reset. The warning offers **Swap**, **Add a water break / a fun game before it** (the drawer opens pre-set to Fun game and isn't held to the gap), and **Keep as is** (remembered on that device for that plan).

## Consequences
- New drills need effort and format set in review; untagged drills simply don't count toward the Hard or skill streaks.
- History follows the drill id, so rotation zones roll up to the rotation. Per-zone history can come later if needed.
- When rules stop being enough, AI suggestions go through one module (build plan, Milestone 5) and build on these same signals.
