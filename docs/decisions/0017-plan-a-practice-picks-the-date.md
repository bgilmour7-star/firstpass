# 0017 · "Add a practice": date and start chosen in a small box, prefilled with a guess

Date: 2026-10-19 · Decided by: Brett

The Plans page had a date box (defaulting to today) and a start time beside "Plan a practice". Brett read
them as filters on the list that did nothing. They set the new plan's date, which is almost never today.

Now the button is "Add a practice", for building a schedule by hand with or without a calendar feed. It opens a
small box (a bottom sheet on a phone) with Date and Start prefilled from a guess (`src/lib/plans/next-date.ts`):
a week after the latest plan at its start time, else the coming Saturday at 9:30, with that reason under the
fields. The coach adjusts and taps "Add practice". If the date and start match an unplanned ice time from the
calendar, the plan takes that ice time, as its "Plan it" would. Calendar ice times keep their own "Plan it".

(An earlier version the same day created the plan straight away on the guessed date, with "Dated …, Change" on
the plan. Brett preferred choosing the date first: "a manual Add a Practice where they can then add a date and time".)
