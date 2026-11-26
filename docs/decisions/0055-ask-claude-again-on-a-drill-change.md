# Decision: Send a drafted drill change back to Claude with a note
Status: Accepted · 2026-11-25 (Brett)

## Context
A coach's suggested change (decision 0018) had two outcomes in review: accept Claude's proposal or decline the request. When the proposal was close but not right (a net in the wrong spot), the only way to fix it was to decline and lose the coach's request, or to accept and fix the drill by hand afterwards.

## Decision
- A drafted change has a third choice on its review page: **Ask Claude to change it**, with a note (up to 1,000 characters).
- The note is added to `drill_requests.feedback` (a list of `{ text, at }`, oldest first, at most 20) and the request goes back to `sent`, keeping its proposal. `drafted_at` and `admin_emailed_at` are cleared, so the "ready to review" email goes out again when the redraw is drafted.
- The next morning run redraws from the earlier proposal, not the live drill, following the newest note (drill-requests skill, step 2c; `npm run drills -- redraw <requestId>` puts the proposal in `content/drills`). Its note says what moved since the last round.
- The review page always shows the live drill and the proposal side by side, the notes by round, and Accept only when a draft is waiting.
- The coach isn't emailed when a change is sent back; they hear the outcome as before, when Brett accepts or declines. Feedback is written only by admins (insert policy); coaches can read their team's rows, so notes should be about the drill, not the coach.

## Limits
- Only changes, not new-drill requests: a drafted new drill is reviewed on Drill review, which already has diagram requests.
- A redraw waits for the next morning run, so each round takes a day unless Brett asks Claude to work it sooner.
