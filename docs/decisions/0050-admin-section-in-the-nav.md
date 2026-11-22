# Decision: Admin pages get their own section in the left nav
Status: Accepted · 2026-11-22 (Brett)

## Context
Analytics, leads, coaches and emails all sat behind one Analytics item, as a row of six tabs at the top of each page (decision 0027). Analytics is something Brett reads; leads, coaches and emails are things he works through. Mixing them hid the work pages and made Analytics look like the place for everything.

## Decision
- **An Admin heading in the left nav**, below the coach items. When the menu is collapsed it shows as a line.
- **Each admin page is its own item:** Drill review (every admin), then Analytics, Leads, Coaches and Emails (Brett only, `requireAnalytics`, decision 0019).
- **Tabs only where two pages pair up:** Leads with Survey (the waitlist survey's answers), and Emails ("All emails") with Send. The nav item stays highlighted on its sibling page.
- Analytics has no tabs.

## Consequences
- A new admin page gets a nav item, or joins a pair in `src/app/admin/tabs.tsx`. Don't grow the tab row back.
- The Admin list is five items now. If it grows past about seven, group it rather than adding a scroll.
