# 0020 · Brand moments on the landing page

Date: 2026-10-20 · Decided by: Brett

## Decision
Of the five brand moments on the "Brand moments" page of the Firstpass Landing Page canvas, Brett chose 1, 2 and 5.
The page stays white; the brand lives in a few owned devices, each carrying meaning.

1. **One teal band, at the close.** The waitlist section sits full-bleed on the share card's deep teal
   (`--band-teal`: `#084F68`, `#0D3E50` in dark mode). The pass line turns white and ends at the teammate ring; the
   form stays on its own surface so it's easy to fill in. It's the only coloured band on the page.
2. **The hero plays its drill.** The Puck Party rink plays once when it comes into view, with the same RinkDiagram
   `animate()` coaches use at the bench, zone by zone with each zone's caption underneath, then settles on the full
   drawing with "Play it again". The drawing is server-rendered, so it works without JavaScript; with reduced
   motion it doesn't move unless the visitor presses "Play the drill". The pass line draws itself as each section
   scrolls in, where the browser supports scroll-driven animation; elsewhere it is simply there.
5. **Small details.** Selected text in the brand teal (app-wide), orange cones instead of numbers on the "how it
   works" steps, and an "Offside." page for addresses that don't exist, with the BrandDevices rink corner. The teal
   keyboard focus ring was already app-wide.

## Not chosen
3, coaching cues pinned to the hero drill, and 4, a faint rink behind a section heading (it read as busy).
