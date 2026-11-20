// Firstpass prices, in CAD per team per season (decision 0044, option B: "every team pays, founders at both
// levels"; project doc "Firstpass pricing strategy and market size"). One place, so the public pages, their
// structured data and the tests agree. Billing isn't built yet, so nothing here charges anyone.

/** Every team is free until this season starts. */
export const PAID_FROM = '2027–28';
/** A new team's free practices once paid plans start, before the team pays. */
export const TRIAL_PRACTICES = 3;

/** A team on its own, paid from the team budget. */
export const TEAM_PRICE = 49;

/** Founding teams (planning this season) and founding associations lock in this rate. */
export const FOUNDING_PRICE = 35;
export const FOUNDING_SEASONS = 2;

/** For price per player. */
export const PLAYERS_PER_TEAM = 12;

export type Tier = { min: number; max: number | null; price: number | null };

/** Association rates by number of U5–U9 teams, passed on to every team. price null = custom. */
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

/** "About $3.50 a player" or "Under $3 a player", for a season. */
export function perPlayer(price: number): string {
  const p = price / PLAYERS_PER_TEAM;
  const up = Math.ceil(p);
  if (up - p > 0 && up - p <= 0.15) return `Under $${up} a player`;
  return `About $${p.toFixed(2)} a player`;
}

export const tierLabel = (t: Tier) => (t.max === null ? `${t.min}+ teams` : `${t.min} to ${t.max} teams`);
