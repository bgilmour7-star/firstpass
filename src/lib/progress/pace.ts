// Season goals: how a team is doing against them (decision 0030, P4). Pure, recomputed on read and
// never stored, so the maths can change without a migration.
//
// A goal is a target spread (kids at levels 1..5) and a date. Its score is that spread's average.
// The expected score is a straight line from the score when the goal was set (the baseline report)
// to the goal score on the goal's date. The latest report's score against that line gives the status.

import { average, round1, type Counts } from './report';
import type { Attribute } from './levels';

export type Goal = {
  id: string;
  attribute: Attribute;
  target: Counts;
  /** YYYY-MM-DD */
  byDate: string;
  /** The round whose report it was set from, and the team's score for the skill in it. */
  baselineRoundId: string;
  baselineScore: number;
  setAt: string;
};

export type Status = 'on-pace' | 'ahead' | 'behind' | 'reached' | 'short';

/** Tolerances: within 0.1 of the line is on pace; 0.2 or more above is ahead. */
export const PACE = { onPace: 0.1, ahead: 0.2 } as const;

export const STATUS_WORDS: Record<Status, string> = {
  'on-pace': 'On pace',
  ahead: 'Ahead',
  behind: 'Behind this month’s target',
  reached: 'Goal reached',
  short: 'Short of goal',
};

/** The goal's score: the average level of its target spread. */
export const goalScore = (target: Counts) => round1(average(target) ?? 0);

const day = (iso: string) => Date.parse(`${iso.slice(0, 10)}T12:00:00Z`);

/** Where the line says the team should be on `at` (YYYY-MM-DD), from `from` (baseline score on its date). */
export function expectedAt(from: { score: number; date: string }, goal: { score: number; date: string }, at: string): number {
  const span = day(goal.date) - day(from.date);
  if (span <= 0) return goal.score;
  const t = Math.min(1, Math.max(0, (day(at) - day(from.date)) / span));
  return round1(from.score + (goal.score - from.score) * t);
}

/** Status of the latest score, given what the line expects for that report's month. */
export function status(latest: number, expected: number, goal: { score: number; date: string }, at: string): Status {
  // Reports are dated the 1st, so the report for the goal's month is the last word on it.
  if (at.slice(0, 7) >= goal.date.slice(0, 7)) return latest >= goal.score - 0.05 ? 'reached' : 'short';
  if (latest >= goal.score) return 'reached';
  const diff = round1(latest - expected);
  if (diff >= PACE.ahead) return 'ahead';
  if (diff >= -PACE.onPace) return 'on-pace';
  return 'behind';
}

/** First day of the month after `month` (YYYY-MM-01). */
export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

/** "About N more kids up a level" by next month's scoring: the line's gain, in kids. Never below 0. */
export function kidsUp(current: number, nextExpected: number, skaters: number): number {
  return Math.max(0, Math.round((nextExpected - current) * skaters));
}

export type GoalPace = {
  goal: Goal;
  /** Score when set, and the month it was set from. */
  from: { score: number; month: string };
  now: number | null;
  target: number;
  expected: number | null;
  status: Status | null;
  /** Kids up a level the line asks for by next month. */
  next: number | null;
};

/**
 * One goal's pace from the reports. `scoreIn(roundId)` gives a round's score for the goal's
 * attribute; `latest` is the newest report this coach can see. Rounds are by month (YYYY-MM-01).
 */
export function pace(goal: Goal, baseline: { month: string; score: number }, latest: { month: string; score: number | null } | null, skaters: number): GoalPace {
  const target = goalScore(goal.target);
  const from = { score: baseline.score, date: baseline.month };
  const to = { score: target, date: goal.byDate };
  if (!latest || latest.score == null) return { goal, from: baseline, now: null, target, expected: null, status: null, next: null };
  const expected = expectedAt(from, to, latest.month);
  const st = status(latest.score, expected, to, latest.month);
  const done = st === 'reached' || st === 'short';
  const nextExpected = expectedAt(from, to, nextMonth(latest.month));
  return { goal, from: baseline, now: latest.score, target, expected, status: st, next: done ? null : kidsUp(latest.score, nextExpected, skaters) };
}

/** The goal in words: "nobody below level 3, and 6 of 12 at level 4 or better". */
export function goalWords(target: Counts): string {
  const n = target.reduce((a, b) => a + b, 0);
  const lowest = target.findIndex((k) => k > 0) + 1;
  const top = target.findLastIndex((k) => k > 0) + 1;
  const parts: string[] = [];
  if (lowest > 1) parts.push(`nobody below level ${lowest}`);
  if (top > lowest) {
    const atTop = target.slice(top - 1).reduce((a, b) => a + b, 0);
    // Name the top level when a third or more of the team is there; otherwise the level below it "or better".
    const best = atTop * 3 >= n || top - 1 <= lowest ? top : top - 1;
    const atBest = target.slice(best - 1).reduce((a, b) => a + b, 0);
    parts.push(best === top ? `${atTop} of ${n} at level ${top}` : `${atBest} of ${n} at level ${best} or better`);
  } else if (lowest > 0) parts.push(`all ${n} at level ${lowest}`);
  const s = parts.join(', and ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
