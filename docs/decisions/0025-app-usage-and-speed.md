# 0025 · Analytics shows how coaches use the app, and how fast it is

Date: 2026-10-22 · Decided by: Brett ("can we add the performance metrics")

## Decision
- **Admin → Analytics, Brett only (decision 0019), gets two more sections** below the landing page numbers, with links at
  the top: Landing page · In the app · Speed · Waitlist. Same 7 / 30-day periods.
- **In the app** counts, never names: active teams (of all teams) and active coaches, each against the period before;
  plans made; the share of practices on the ice that got a check-in (the loop that feeds suggestions, decision 0022);
  teams active in both periods; coaches who opened the installed app; coaches in the app each day; the drills on the ice
  with their Big hits and Flops; plans shared with parents, suggestions kept, drills starred, drills asked for.
- **Where it comes from:** the tables the app already keeps (practices, edits, check-ins, shares, kept suggestions,
  favourites, drill requests) plus one new row a coach a day, `app_opens`, saying whether they opened it from the home
  screen. The app shell sends it once a day per mode. `app_usage(since)` is a security-definer function that returns the
  raw rows only to analytics viewers; the page works the numbers out (`src/lib/site/usage.ts`, tested).
- **Speed** is Core Web Vitals from real visits (`next/web-vitals`), batched per page and sent with `sendBeacon` to
  `/api/vitals` when the page is hidden. Kept: metric, value, kind of page (Landing, Planner, Check-in…, never an id),
  kind of device. No visitor id, user or address; rows older than 90 days are deleted. Shown as the 75th percentile
  with Google's good / needs work / poor lines: Page shows (LCP), Taps respond (INP), Stays still (CLS), by page and
  by device.
- **Our own table, not Vercel Speed Insights,** so speed sits next to usage on one page, nothing extra to switch on or pay
  for, and the privacy page stays true in one place.

## Why
The landing page numbers say whether coaches are interested; they don't say whether the app works for them. The pilot's
question is whether teams keep planning and checking in, and whether the planner is fast enough on a phone at the rink.

## Also
The first analytics migration gave access to brett@paddio.ca, but Brett signs in as bgilmour7@gmail.com, so the
Analytics link never showed. Both migrations now name both addresses.

## Not done
- Rink-side opens and parent-link views (no events yet).
- Per-team drill-downs. With a handful of pilot teams, counts are enough.
