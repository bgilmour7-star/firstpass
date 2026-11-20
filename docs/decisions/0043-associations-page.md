# 0043 · Associations page with public pricing

Date: 2026-11-20 · Decided by: Brett ("Associations pricing discount looks like what I was expecting. We need to show
that on the page, like a pricing tier, so communicate the value."). Task 3 of the "Firstpass SEO and AEO plan".

## Decision
- **A public page at `/associations`**, in the sitemap and open without sign-in, linked from the landing and answer-page
  footers. Its one ask is the existing association form ("Talk to Brett", decision 0033).
- **Prices are public, per team per season in CAD** (pricing work, October 2026): a team on its own $49; associations
  with 5–9 teams $42, 10–24 teams $35, 25+ custom. One module, `src/lib/site/pricing.ts`, feeds the page, its
  structured data (Product with an AggregateOffer, FAQPage) and the tests.
- **What associations asked for** (Brett, 2026-11-19): a view of all their teams, setting up teams and assigning
  coaches, a real discount per team, and either one bill or each team paying from its own budget at the association
  rate.
- **Honest about what's built.** The association view, team setup and billing aren't built yet (build plan: later).
  A "Where it stands" section says they're being built with the first associations and that Brett sets teams up with
  them until then.
- **The association sees planning activity only.** Team progress scores and coaches' notes stay with the team's
  coaches (decision 0030). The FAQ says so.
- A coach's first team stays free; the page uses it as the way one team tries Firstpass first.

## Revisit when
- Billing is built (Stripe): the page's numbers must match what's charged.
- The first association signs: replace "Where it stands" with what they actually use.
