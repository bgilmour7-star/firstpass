# Decision: After-practice check-in, Strava style
Status: Accepted · 2026-10-18 (Brett, after the "Strava option" mock)

## Context
Check-in data feeds everything after it: warnings on drills, the add-a-drill drawer, the variety check. The first design asked for a rating on every drill, seven reason tags and a 3×3 readiness grid. It ran to three phone screens against a promise of "about 20 seconds", and it asked about boredom twice (a drill reason and a practice question). Brett picked the Strava-style option: one quick pass, detail only where something stood out.

## Options
| Option | Time to launch | Monthly cost | Lock-in | Future-proofing | Key risk |
|---|---|---|---|---|---|
| A. Strava style: overall answer, lost steam (and from when), mark only standouts (OK by default), groups ready | Days | $0 | Low | Same data supports warnings, drawer feedback and the variety check | Unmarked drills read as OK even when the coach just skipped them |
| B. Rate every drill (Flopped / OK / Big hit), reasons on OK or Flopped | Days | $0 | Low | Richer per-drill data | Coaches abandon it; little data at all |
| C. Overall rating only | Hours | $0 | Low | Weak: nothing per drill | Can't say which drill was the problem |

## Decision
A.
- **Questions, in order:** How was it? (Rough / OK / Great) · Did they lose steam? (No / Got bored / Got tired, then "From about" which drill, pre-filled from the first Flopped) · Any standouts? (Big hit or Flopped; everything else counts as OK) · Ready for harder? (tap groups that are) · optional note, "No kids' names".
- **Reasons describe the drill only:** Too much waiting, Too hard, Too easy, Confusing setup, and only under a drill marked Flopped. Boredom and tiredness are about the order of drills, so they live in the lost-steam question.
- **Rotations are rated per zone; stations and drills once each.** Water, huddles and other activities aren't rated.
- **Every coach checks in separately; answers are never averaged.** A co-coach's choice shows as their initial on the button they chose. Agreeing marks count as a Big hit or Flopped; disagreeing marks show as a split. Lost steam is the earliest point any coach gave.
- **Selected answers use one neutral fill.** Colour (green, orange) is kept for the summary, not the input.
- **After Save, the reward:** what the answers add up to (Big hits, Flopped, when they lost steam), "For your next plans" in plain words, and who has checked in.
- **Where it's asked:** Today after the ice time ends; "Check in" on the practice in Plans (last 14 days); and first when you open the next plan, with Skip. Saving marks the practice Done.
- **Storage:** `practice_checkins`, one row per coach per practice, marks as a small JSON list keyed by block (and zone), with the drill id so history follows the drill. RLS by team; coaches write only their own row.
- **Not yet:** using the answers in warnings, the drawer and the variety check (next), the email 30 minutes after practice, and nudging a coach who hasn't checked in.
