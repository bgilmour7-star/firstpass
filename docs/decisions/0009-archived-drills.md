# 0009 — Archiving drills

Date: 2026-10-18 · Status: accepted

## Context
Reviewers (Brett and the head coach) need a way to say "this drill isn't good enough" without deleting it. Deleting loses the drill's history, notes and check-in feedback, and plans that used it.

## Decision
- A fifth drill status, **Archived**. Any drill can be archived from drill review, from any status, even with a diagram change open.
- Archiving asks for an optional reason. It's saved as a review note ("Archived: …"), so whoever restores it later can see why.
- Archived drills never reach coaches (only Live does). A plan that already uses one shows "This drill isn't live any more. Swap it".
- The review queue hides archived drills from All; they have their own Archived tab, shown only when there are some.
- **Restore to review** is the only way back, so a restored drill is looked at again before it can go live.

## Consequences
- Migration `20261020000000_archived_drills.sql` widens the status check on `public.drills`.
- Open diagram requests on an archived drill stay open; whoever works the queue can skip them.
