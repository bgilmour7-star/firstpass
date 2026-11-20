# 0044 · Pricing: free this season, then every team pays; founders at both levels

Date: 2026-11-20 · Decided by: Brett (pricing discussion, canvas "Firstpass associations page", project doc
"Firstpass pricing strategy and market size"). Replaces "Your first team is free" from decision 0033 as a promise
on public pages.

## Decision
- **This season (2026–27) is free for every team.** Public pages say "Free for every team this season", not "Your
  first team is free". Sign-up stays open and free (decision 0033); only the promise changes.
- **From 2027–28 every team pays.** A new team gets its first 3 practices free, then pays $49 a season from the
  team budget. The coach sends a pay link to the team manager; coaches never pay out of pocket.
- **Associations buy a bulk rate that every team gets:** $42 a team (5–9 teams), $35 (10–24), custom (25+). One
  bill, or each team pays its share at that rate. Parents never pay.
- **Founders at both levels.** Teams planning in Firstpass this season are founding teams, and associations that
  commit before their 2027–28 budget is set are founding associations. Both lock in $35 a team (or less) for two
  seasons.
- Prices live in `src/lib/site/pricing.ts`, the one source for the public pages and their structured data.

## Why
Brett: "I don't think individual teams being free works long term. It undermines the value for an association to
sign up and get the bulk rate for the core tools. I don't think progress reports and visibility are enough value
for them to purchase the association capabilities. They need to pass the savings onto the individual teams."
With every team paying $49 on its own, an association's bulk rate is a saving its teams can see ($168 a season for
12 teams).

## Risks and what to watch
- **The paywall after practice 3.** If the team manager's approval takes longer than the next practice, the coach
  drops off. Watch how many teams pay within a week of practice 3; if most stall, add a grace period to pay.
- Nothing is evidence yet: 3 teams, 0 association leads. The first test is asking this season's teams to commit as
  founding teams.

## Not done (yet)
- Billing, the pay link, the trial count and the association view aren't built. Nothing charges anyone.
- Emails and in-app copy don't mention pricing.
