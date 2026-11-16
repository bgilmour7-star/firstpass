# 0032 · Next practice: Before, During and After by the clock

Date: 2026-11-16 · Decided by: Brett (canvas "Firstpass Next practice · before, during, after", https://claude.ai/artifact/NS7ZSL3gmsG7BPEiQ9W7og) · Changes part of 0015 and 0031

## Decision
- `/today` (nav: Today or Next practice) has three states, chosen by the clock, not by a setting:
  - **Before** (any earlier day, and practice day until 15 minutes before the start): the plan as a sheet to prepare
    from. Header "Next practice · in 5 days", the date, then time, ice, skaters and groups, coaches on the ice; actions
    **Print**, **Share** and **Edit the plan**, each an icon with a label as on the plan page. Each drill is a row with its
    start time, the `RinkDiagram` thumb, its name, one line of description, minutes and **New today: worth a look** when
    the kids haven't done it. Water, free skate and the huddle are thin rows. On a computer one drill is open beside the
    list (the first to start with): its diagram with the key, stations and who's at each, the description, **Say:** the
    cues, **Set up:** the gear. On a phone a drill opens its details sheet.
  - **During** (from 15 minutes before the start to the end): rink-side. A Now card with the block's time, name, time
    left and a progress bar (before the start: First up and the time to the start), the whistle for a rotation, the
    diagram, stations and cues; then **Up next** (skipping water); Start the clock now; **Whole practice** folded below.
  - **After** (practice day once it's over, and earlier days): the check-in first, then What you ran.
- No goal marks on drills, here or on Home's strip: every skill can have a goal (0031), so a mark would be everywhere.
- **Team settings** is its own item at the bottom of the left rail, above the account, for every coach (read-only for
  coaches who aren't head coach). It leaves the account menu. Home is not highlighted on `/team/settings`.

## Why
- The old page was one phone timeline for every moment. Days before, a coach is preparing and wants every drill with its
  diagram; at the rink they want one block, big; after, the only job is the check-in.
- Brett's comments on the canvas: actions match the plan page; goals per skill make a goal mark noise; settings are
  easier to find at the bottom of the nav than in the team switcher.

## Revisit when
- Coaches open During from the bench and miss the actions (Print, Share), or ask for the Before sheet on practice day.
