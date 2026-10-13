# Decision: Drill review is an admin screen in the app; diagrams change by request
Status: Accepted · 2026-10-13

## Context
Brett and the head coach review drills one at a time, as the library needs them. They edit text directly and describe diagram changes in words; Claude redraws. Coaches never edit drills (v1 scope).

## Options
| Option | Time to launch | Monthly cost | Lock-in | Future-proofing | Key risk |
|---|---|---|---|---|---|
| A. Admin screen in the Next.js app + diagram requests table + CLI for Claude | ~1 day | $0 | None | It is the real app; nothing thrown away | Claude needs DB access to work requests |
| B. A separate claude.ai page with its own store | Hours | $0 | Medium (data outside our DB) | Rebuilt later | Two sources of truth |
| C. Visual diagram editor for admins | Weeks | $0 | None | Most flexible | Big build for a few edits a week |

## Decision
A. The screen lives at `/admin/drills`, gated by `requireAdmin()` and RLS (`public.admins`). Status moves Draft → In review → Approved → Live; approval is blocked while a diagram request is open or the group model is unresolved. Claude works requests with `npm run drills` (see CLAUDE.md).

## Consequences
- Claude sessions need `SUPABASE_SERVICE_ROLE_KEY` and network access to the Supabase host, or Brett pastes requests in.
- Diagram changes take a Claude round trip. Acceptable at a few drills a week.

## Revisit when
Requests pile up (more than ~10 open), or more than two people review. Then consider a scheduled Claude task that works the queue, or a simple position editor.
