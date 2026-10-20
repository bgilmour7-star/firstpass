# 0017 · "Plan a practice" picks the date; no date and time boxes on Plans

Date: 2026-10-19 · Decided by: Brett

The Plans page had a date box (defaulting to today) and a start time beside "Plan a practice". Brett read
them as filters on the list that did nothing. They set the new plan's date, which is almost never today.

Now "Plan a practice" is one button. It dates the plan (`src/lib/plans/next-date.ts`):
1. the next practice ice time from the team calendar with no plan yet (the same as its "Plan it");
2. else a week after the latest plan, at its start time (moved on a week at a time until it's in the future);
3. else the coming Saturday at 9:30.
The new plan says so under its title: "Dated Sat, Oct 31, a week after your last one · Change", and Change opens
the existing "Date, time and ice" dialog.
