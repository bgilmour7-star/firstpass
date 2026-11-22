# Decision: Save where each account came from
Status: Accepted · 2026-11-22 (Brett)

## Context
The lead funnel (decision 0051) shows where leads drop off on the site, but its app steps aren't linked to visits. To know which channels bring coaches who actually run practices, not just visitors, each account needs to carry where it came from.

## Decision
- When an account is made (its first sign-in, `isNewAccount`), `record_account_source` saves one row in `account_sources`: whether it was an invite, and the referring site or link tag and the landing page of that browser's first visit that day. The link is the same daily visitor hash as the visit counts (decision 0019), worked out in the database from the sign-in request. No cookies or device storage.
- The row is written once, by the account's own session, through a security-definer function. Nobody reads the table directly (its only policy allows no one; `20261128010000_account_sources_private.sql`); the report is the only way in, and it gives each account's day, not its time, so a row can't be matched back to that day's visits.
- Admin → Analytics → **Where accounts came from**: new accounts by channel, then Not traced, then Invited to a team, with how many made a team and how many ran a practice (as head coach). It also shows the pages they first landed on. `account_sources_report` returns dates and yes/no answers only: no ids, emails or names.

## Limits
- Same day, same browser. A coach who visits Monday and signs up Wednesday is "Not traced", and so is a magic link opened in an email app's own browser. Following someone across days needs device storage, which would change decision 0019 and the privacy page. Not done.
- Accounts made before this change have no row, so they show as Not traced.
