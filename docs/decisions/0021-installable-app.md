# 0021 · Firstpass installs to the home screen and opens Today with no signal

Date: 2026-10-20 · Decided by: Brett

## Decision
- **An installable web app, not an app-store app.** `src/app/manifest.ts`: name Firstpass, opens to **/today**,
  scope the whole site, standalone, a Plans shortcut. Icons are the design system's app icon (white mark on
  `#084F68`): 192, 512, a maskable 512 and the 180px Apple icon, in `public/icons/` and `src/app/apple-icon.png`.
  `viewport-fit=cover` turns on the safe-area spacing the app already had; the status bar matches the page.
- **Today works at the rink with no signal.** A hand-written service worker (`src/lib/pwa/worker.ts`, served at
  `/sw.js` with the deploy's commit as its version):
  - The plain `/today` page load comes from the network and the latest copy is saved, with the time it was saved.
    With no signal the saved copy opens, and Today says "Offline · saved at 9:12". A redirect (signed out) is
    never saved.
  - App files (`/_next/static`, `/icons`) are saved on first use and dropped when a new version takes over.
  - Any other coach page with no signal shows `public/offline.html`. It's plain HTML because it's served in place
    of other pages, and a Next.js page refuses to run under another page's address.
  - Never saved: `/`, sign-in, auth, admin, the API, parent links, join links, privacy, emails and the share card.
    The sign-in screen clears the saved copy, so a signed-out phone keeps nobody's plan.
- **Updates wait for the coach.** A new deploy is a new worker; the app shows "New version ready · Reload" and
  never reloads by itself mid-practice.
- **Asking coaches to install:** a card on **Today on phones** (above the plan on other days, after it on practice
  day), and an always-there **Account → Install on your phone**. Android gets an Install button (the browser's own
  prompt) when the browser offers one, else the menu steps; iPhone gets the Share → Add to Home Screen steps and a
  line that the app asks to sign in once with the 6-digit code. "Not now" hides the card for 30 days on that phone.
  Never shown once installed, on a computer, to parents, or on the landing page.

## Why
Brett wants Firstpass on his phone and an easy way for his co-coaches to install it. Rinks often have no signal,
which is the real reason an installed app beats a browser tab.

## Not done
- Keeping the screen awake during practice (Brett: not needed).
- Notifications (the check-in reminder could become one; iPhones allow it for installed apps).
- Editing plans offline.
- Counting installs in Analytics.
