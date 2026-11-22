# Decision: Save the failures the app catches
Status: Accepted · 2026-11-22 (Brett)

## Context
Most of Firstpass catches its failures and carries on (an email that didn't send, an analytics write, a join that went wrong) and logs them, so Vercel's error summary stays empty. Vercel's Hobby plan keeps logs for under an hour, so nobody sees them. Pro keeps a day, for about US$20 a month.

## Decision
- Every server-side `console.error` goes through `logError()` (`src/lib/errors.ts`). It still logs to the console, and after the response it saves a copy to `app_errors` in Supabase (Canada): an area from the message's `[tag]` and the message.
- Before saving, emails, phone numbers, ids (uuids) and long tokens are replaced with `<email>`, `<phone>`, `<id>` and `<token>`. Nothing is saved about who saw the error.
- `record_app_error` (security definer) is the only way in. It takes at most 300 rows an hour and deletes rows older than 30 days. Only analytics viewers can read the table.
- Admin → Analytics → **Errors** shows the last period's failures by area, with the latest message. The "Firstpass morning" scheduled task reports yesterday's in its summary.
- Middleware (edge) and browser code still only log to the console.

## Limits
- Errors that crash a request (not caught) are still only in Vercel's error summary, which keeps 7 days. The morning task checks that too.
- The scrubbing is pattern-based. A name in a message would get through, so log messages must keep naming things by id or code, never by name (the existing rule).
