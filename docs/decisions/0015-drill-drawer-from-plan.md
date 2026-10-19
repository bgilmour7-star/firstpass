# 0015 · Opening a drill from a plan keeps you on the plan

Date: 2026-10-19 · Decided by: Brett

## Decision
Tapping a drill's title or diagram in the plan builder opens the drill in a side drawer over the plan
(full-width sheet on a phone), not the drill page. Escape, the backdrop, ✕ or "Back to the plan" close it,
and the plan stays exactly as it was (scroll, unsaved edits, open menus). The drawer shows the same
content as the drill page, from one shared component (`src/components/drill-detail.tsx`), plus the team
star. "Open full page" goes to `/drills/<id>?from=/plans/<plan id>`, and the drill page then shows
"← Back to <date>'s plan" instead of "← All drills" (only for a plan on the coach's own team).

## Why
Brett: "it navigates to the drill page and I lose my navigation directly back to the practice plan… open a
drawer with the drill from the practice plan (preferred)". Planning is the job; reading a drill is a detour.
