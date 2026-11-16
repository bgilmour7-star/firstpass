// Ice time by skill, and the share goals ask for (decision 0030). Rules, no AI.
//
// Share of a plan's time: each drill block's minutes count fully toward its Main skills and half
// toward its Some skills (practiceFocus scores Main 2, Some 1 per minute, so the ratio is the same).
// Activities (water, huddle, free skate) count toward nothing. Shares add up to 1.
//
// Target share: every skill starts even (1/6). Each active goal adds weight for the gap it still has
// to close, and one more step when it's behind this month's target. Every skill keeps at least 10%,
// and the shares add up to 1. Tune the numbers in TARGET, not the logic.

import { practiceFocus, type Block } from '../plans/schema';
import type { Drill } from '../drills/schema';
import { ATTRIBUTES, type Attribute } from './levels';

export const TARGET = {
  /** Weight added per level of gap still to close. Base weight per skill is 1. */
  perLevel: 1,
  /** Extra weight for a goal behind this month's target. */
  behind: 0.5,
  /** Every skill keeps at least this share. */
  floor: 0.1,
} as const;

export type Shares = Record<Attribute, number>;

const empty = (): Shares => Object.fromEntries(ATTRIBUTES.map((a) => [a, 0])) as Shares;

/** Share of time by skill across these plans. All zero when they have no drill time. */
export function timeShares(plans: { blocks: Block[] }[], byId: Map<string, Pick<Drill, 'focus'>>, groupCount = 3): Shares {
  const s = empty();
  for (const p of plans) for (const f of practiceFocus(p.blocks, byId, groupCount)) s[f.attribute as Attribute] += f.score;
  const sum = Object.values(s).reduce((a, b) => a + b, 0);
  if (!sum) return s;
  for (const a of ATTRIBUTES) s[a] /= sum;
  return s;
}

/** The share each skill should get, from the active goals' remaining gaps. */
export function targetShares(goals: { attribute: Attribute; gap: number; behind: boolean }[]): Shares {
  const w = Object.fromEntries(ATTRIBUTES.map((a) => [a, 1])) as Shares;
  for (const g of goals) w[g.attribute] += Math.max(0, g.gap) * TARGET.perLevel + (g.behind ? TARGET.behind : 0);
  // Normalise, then lift anything under the floor and take the difference from the rest, in proportion.
  const fixed = new Set<Attribute>();
  for (let pass = 0; pass < ATTRIBUTES.length; pass++) {
    const free = ATTRIBUTES.filter((a) => !fixed.has(a));
    const left = 1 - fixed.size * TARGET.floor;
    const sum = free.reduce((a, k) => a + w[k], 0);
    const under = free.filter((a) => (w[a] / sum) * left < TARGET.floor);
    if (!under.length) {
      const out = empty();
      for (const a of ATTRIBUTES) out[a] = fixed.has(a) ? TARGET.floor : (w[a] / sum) * left;
      return out;
    }
    under.forEach((a) => fixed.add(a));
  }
  return Object.fromEntries(ATTRIBUTES.map((a) => [a, 1 / ATTRIBUTES.length])) as Shares;
}

/** "20%" */
export const pct = (x: number) => `${Math.round(x * 100)}%`;
