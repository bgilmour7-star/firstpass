# 0016 · The first nav item names the practice it opens

Date: 2026-10-19 · Decided by: Brett

The left nav's first item opens rink-side view of the coming practice. It used to say "Today" even when
that practice was days away. Now it says "Today" with the start time ("9:45") on practice day, and otherwise
"Next practice" with the date ("Sat, Oct 24"), or "Nothing planned". The calendar icon shows that practice's
day of the month, so the collapsed rail says it too. It picks the practice the page shows: today's (all day),
else the next one ahead (`src/lib/nav-practice.ts`).

Not chosen: "Next" (unclear next what, beside Plans) and the bare date as the label (reads as a calendar
entry, changes every few days, and has nothing to say when no practice is planned).
