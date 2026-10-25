# 0025 · An icon drawing of Puck to teammate

Date: 2026-10-25 · Decided by: Brett (page "Firstpass App Icon"; ten other logo directions, a "1" mark and FP monograms explored and turned down)

## Decision
- **The logo stays Puck to teammate.** Small places get their own drawing of it, so it reads as a favicon and a
  home-screen icon. The lockup in the nav, emails and landing page doesn't change.
- **The icon drawing:** the lockup's angle and parts, scaled to fill the tile (about 85% of its width, up from about 40%).
  The puck is a flat ellipse, the pass is two square-ended dashes (each longer than it is thick, so they don't read as the
  backward-skating ticks), and the arrowhead is dropped. White on deep teal `#084F68` (rink-200).
- **Three drawings, one idea:**
  - **Standard** (`design-system/icons/app-icon.svg`): full bleed; the OS rounds the corners. Apple icon 180, manifest
    icons 192 and 512.
  - **Maskable** (`app-icon-maskable.svg`): the same mark at 78%, inside Android's 80% safe circle. Manifest `maskable` 512.
  - **16px** (`favicon-16.svg`): one dash, drawn on a 16px grid, so the pass still reads in a tab.
- **The favicon sits on a rounded teal tile,** the same in light and dark tabs (it used to be the bare mark, switching
  colour). `src/app/icon.svg` is the 16px drawing; `src/app/favicon.ico` holds 16 (the 16px drawing), 32 and 48 (standard).

## Why
Brett liked the logo but it didn't show up well as an app icon or a tab icon. The old icon used about a third of its tile,
and its three thin dashes and arrowhead blurred together below 48px.

## How to change it
The SVGs in `design-system/icons/` are the source. The PNGs and the .ico are rendered from them at exact pixel sizes
(no resizing), so a change means re-rendering all six files. Installed apps pick up new icons after the next deploy, when
the service worker's new version drops the old `/icons` cache (decision 0021); the home-screen icon itself updates when
the phone's OS re-reads the manifest (Android) or the app is re-added (iPhone).
