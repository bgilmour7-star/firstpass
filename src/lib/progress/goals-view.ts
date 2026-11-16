// Season goals as a screen shows them (decision 0030, part C): pace from the reports this coach can
// see, ice time since the goal was set, and the share of time the goals ask for. Pure.

import type { Drill } from '../drills/schema';
import type { Practice } from '../plans/schema';
import { timeShares, targetShares, type Shares } from './ice-time';
import type { Attribute } from './levels';
import { pace, type Goal, type GoalPace } from './pace';
import { canSeeReport, teamReport, type CoachScore, type Round } from './report';

export type GoalView = GoalPace & {
  /** Month the goal was set from (YYYY-MM-01), when known. */
  baselineMonth: string;
  /** Month of the report `now` comes from. */
  latestMonth: string | null;
  /** Share of drill time this skill got in practices since the goal was set; null before any. */
  share: number | null;
  targetShare: number;
};

export type GoalsView = { goals: GoalView[]; targets: Shares };

/** `rounds` newest first. `today` YYYY-MM-DD. */
export function goalsView(goals: Goal[], rounds: Round[], scores: CoachScore[], userId: string, practices: Pick<Practice, 'date' | 'blocks'>[], byId: Map<string, Pick<Drill, 'focus'>>, today: string): GoalsView {
  // The newest report this coach can see.
  const seen = rounds.find((r) => canSeeReport(scores, r.id, userId));
  const latest = seen ? teamReport(seen, scores) : null;
  const scoreOf = (a: Attribute) => latest?.attributes.find((x) => x.attribute === a)?.score ?? null;
  const skaters = seen?.skaters ?? rounds[0]?.skaters ?? 0;
  const paced = goals.map((g) => {
    const base = rounds.find((r) => r.id === g.baselineRoundId);
    const baselineMonth = base?.month ?? g.setAt.slice(0, 7) + '-01';
    const now = scoreOf(g.attribute);
    return { g, baselineMonth, p: pace(g, { month: baselineMonth, score: g.baselineScore }, seen ? { month: seen.month, score: now } : null, skaters) };
  });
  const targets = targetShares(paced.map(({ g, p }) => ({ attribute: g.attribute, gap: p.target - (p.now ?? g.baselineScore), behind: p.status === 'behind' })));
  const views = paced.map(({ g, baselineMonth, p }): GoalView => {
    const since = practices.filter((x) => x.date >= g.setAt.slice(0, 10) && x.date <= today && x.blocks.length);
    const shares = since.length ? timeShares(since, byId) : null;
    const total = shares ? Object.values(shares).reduce((a, b) => a + b, 0) : 0;
    return { ...p, baselineMonth, latestMonth: seen?.month ?? null, share: shares && total ? shares[g.attribute] : null, targetShare: targets[g.attribute] };
  });
  return { goals: views, targets };
}
