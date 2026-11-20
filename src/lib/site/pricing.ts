// Firstpass prices, in CAD per team per season (pricing work, October 2026; association page, decision 0043).
// One place, so the public page, its structured data and the tests agree. Billing isn't built yet
// (build plan: "Stripe billing (second team)"), so nothing here charges anyone.

export const TEAM_PRICE = 49;

export type Tier = { min: number; max: number | null; price: number | null };

/** Association rates by number of U5–U9 teams. price null = custom. */
export const ASSOCIATION_TIERS: Tier[] = [
  { min: 5, max: 9, price: 42 },
  { min: 10, max: 24, price: 35 },
  { min: 25, max: null, price: null },
];

export const LOWEST_ASSOCIATION_PRICE = Math.min(...ASSOCIATION_TIERS.flatMap((t) => (t.price === null ? [] : [t.price])));

/** The per-team rate for an association of this many teams; TEAM_PRICE below the first tier, null for custom. */
export function rateFor(teams: number): number | null {
  const tier = ASSOCIATION_TIERS.find((t) => teams >= t.min && (t.max === null || teams <= t.max));
  return tier ? tier.price : TEAM_PRICE;
}

/** Whole percent off the team price. */
export const savingPct = (price: number) => Math.round((1 - price / TEAM_PRICE) * 100);

export const tierLabel = (t: Tier) => (t.max === null ? `${t.min}+ teams` : `${t.min} to ${t.max} teams`);
