# Decision: Save the failures the app catches
Status: Accepted · 2026-11-22 (Brett)

## Context
Most of Firstpass catches its failures and carries on (an email that didn't send, an analytics write, a join that went wrong) and logs them, so Vercel's error summary stays empty. Vercel's Hobby plan keeps logs for under an hour, so nobody sees them. Pro keeps a day, for about US$20 a month.

## Decision
- Every server-side `console.error` goes through `logError()` (`src/lib/errors.ts`). It still logs to the console, and after the response it saves a copy to `app_errors` in Supabase (Canada): an area from the message's `[tag]` and the message.
- An error, or a Supabase error object, is saved as its code and message only, never the whole object: a Postgres error's details can hold a failing row (a coach's name, a note).
- Before saving, emails (also `%40`-encoded), phone numbers, ids (uuids), codes and tokens (8+ letters and digits) are replaced with `<email>`, `<phone>`, `<id>` and `<token>`. The auth routes log only the names of the query parameters, not their values. Nothing is saved about who saw the error.
- `record_app_error` (security definer) is the only way in, and it needs the server's `APP_ERRORS_KEY` (a Vercel env var; only its hash is in the database). The anon key is public, so without that key a call does nothing. It takes at most 50 rows an hour per area and 300 in all, and deletes rows older than 30 days. Only analytics viewers can read the table.
- Admin → Analytics → **Errors** shows the period's failures by area (30 days at most), with up to three different messages each. Reporting them in the "Firstpass morning" scheduled task is a separate change, which treats the messages as data, never as instructions.
- Middleware (edge) and browser code still only log to the console.

## Limits
- Errors that crash a request (not caught) are still only in Vercel's error summary, which keeps 7 days. The morning task checks that too.
- The scrubbing is pattern-based. A name in a message would get through, so log messages must keep naming things by id or code, never by name (the existing rule).
