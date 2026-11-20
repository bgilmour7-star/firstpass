import { describe, expect, it } from 'vitest';
import { ASSOCIATION_TIERS, LOWEST_ASSOCIATION_PRICE, TEAM_PRICE, rateFor, savingPct } from './pricing';

describe('association pricing', () => {
  it('tiers run in order with no gaps', () => {
    for (let i = 1; i < ASSOCIATION_TIERS.length; i++) expect(ASSOCIATION_TIERS[i].min).toBe((ASSOCIATION_TIERS[i - 1].max ?? 0) + 1);
  });
  it('every association rate is below the team price, and falls with more teams', () => {
    const prices = ASSOCIATION_TIERS.flatMap((t) => (t.price === null ? [] : [t.price]));
    for (const p of prices) expect(p).toBeLessThan(TEAM_PRICE);
    expect([...prices].sort((a, b) => b - a)).toEqual(prices);
  });
  it('gives the right rate for a team count', () => {
    expect(rateFor(3)).toBe(TEAM_PRICE);
    expect(rateFor(5)).toBe(42);
    expect(rateFor(12)).toBe(LOWEST_ASSOCIATION_PRICE);
    expect(rateFor(30)).toBeNull();
  });
  it('rounds savings to whole percent', () => expect(savingPct(35)).toBe(29));
});
