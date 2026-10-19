# Decision: Team favourite drills
Status: Accepted · 2026-10-18 (Brett: "a coach … favorite drills on behalf of the team")

## Context
Coaches return to the same handful of drills. The library and the add-a-drill drawer had no way to mark them, so every coach scrolled the whole library each time.

## Options
| Option | Time to launch | Monthly cost | Lock-in | Future-proofing | Key risk |
|---|---|---|---|---|---|
| A. One shared star per team; any coach stars or unstars; we keep who and when | Hours | $0 | Low | Per-coach stars can be added beside it | One coach unstars another's pick; "Starred by" shows who added it |
| B. Each coach stars for themselves | Hours | $0 | Low | Same | Doesn't do what was asked: favourites on behalf of the team |

## Decision
A.
- **A star, not a heart.** The heart already means "Kids loved it" (Big hits from check-ins), which is about the kids; the star is the coaches' own pick.
- **Where:** a star on every card in the library (top right, over the diagram) and on the drill page ("Star for the team" / "Team favourite", with "Starred by Kara · Oct 18"); a filled star next to favourites in the add-a-drill drawer.
- **Favourites come first** in the library and the drawer. The library has a "Team favourites" chip with the count; the drawer has a "Team favourites" filter that shows once the team has any, greyed out when the slot's other filters leave none.
- **Storage:** `team_favorites` (team, drill, who, when), RLS by team membership; any coach on the team can star or unstar.
