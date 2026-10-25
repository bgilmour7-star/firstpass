import { AGE_GROUPS, levelCount, type AgeGroup, type Drill } from './schema';

// Which drills a team sees (decision 0025). Every coach-side list that offers drills to pick (the
// library, the add-a-drill drawer, swaps, suggestions, the first plan) goes through drillsForAge,
// so the rule lives in one place. Drills already in a plan still show wherever the plan is read.

/**
 * Until there are this many live U9 drills, a U9 team also sees U7 drills that have levels, started
 * at their top level. Set it to 0 to turn the fallback off.
 */
export const U9_FALLBACK_BELOW = 10;

export const U9_FALLBACK_NOTICE = "U9 drills are new. Until there are more, you'll also see U7 drills at their harder levels.";

export type AgeLibrary = {
  drills: Drill[];
  /** One line to show above the drills when the U9 fallback is on; null otherwise. */
  notice: string | null;
};

const isAge = (a: string): a is AgeGroup => (AGE_GROUPS as readonly string[]).includes(a);
const hasLevels = (d: Drill) => d.groupModel === 'basic' && levelCount(d) > 1;

/** The drills a team of this age can pick from. */
export function drillsForAge(drills: Drill[], ageGroup: string): AgeLibrary {
  const age = ageGroup.trim().toUpperCase();
  if (!isAge(age)) return { drills: [], notice: null };
  const own = drills.filter((d) => d.ageGroups.includes(age));
  if (age !== 'U9' || own.length >= U9_FALLBACK_BELOW) return { drills: own, notice: null };
  // U9 with few drills: borrow U7 drills that have levels, starting at their top level.
  const borrowed = drills
    .filter((d) => !d.ageGroups.includes('U9') && d.ageGroups.includes('U7') && hasLevels(d))
    .map((d) => ({ ...d, startLevel: { ...d.startLevel, U9: levelCount(d) } }));
  return { drills: [...own, ...borrowed], notice: borrowed.length ? U9_FALLBACK_NOTICE : null };
}
