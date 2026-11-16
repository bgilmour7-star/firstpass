// Team progress: the maths behind scoring and the report (decision 0030). Pure: no storage.
// A coach's answer for one attribute is five counts, kids at levels 1..5 ([2,5,5,0,0]). The report
// is always computed from the finished coaches' answers; it is never stored.

import { ATTRIBUTES, type Attribute } from './levels';

export type Counts = [number, number, number, number, number];
export type Answers = Partial<Record<Attribute, Counts>>;

export type Round = {
  id: string;
  teamId: string;
  /** First day of the month, YYYY-MM-01 (Vancouver time). */
  month: string;
  openedAt: string;
  closedAt: string | null;
  levelsVersion: string;
  /** Team size when the round opened. */
  skaters: number;
};

export type CoachScore = {
  roundId: string;
  userId: string;
  /** First name, for "Brett 1.7 · Kara 2.7". */
  name: string;
  answers: Answers;
  done: Attribute[];
  noChange: Attribute[];
  startedAt: string;
  finishedAt: string | null;
  seconds: number | null;
};

export const EMPTY: Counts = [0, 0, 0, 0, 0];

export const total = (c: Counts) => c.reduce((a, b) => a + b, 0);

/** Average level, or null when nobody is placed. */
export function average(c: Counts): number | null {
  const n = total(c);
  return n ? c.reduce((a, b, i) => a + b * (i + 1), 0) / n : null;
}

export const round1 = (x: number) => Math.round(x * 10) / 10;

/** Five non-negative whole numbers adding up to no more than the team. */
export function validCounts(c: unknown, skaters: number): c is Counts {
  return Array.isArray(c) && c.length === 5 && c.every((n) => Number.isInteger(n) && n >= 0) && total(c as Counts) <= Math.max(skaters, 0) && total(c as Counts) > 0;
}

/** Move one skater from a level to the next one up (+1) or down (-1). The total never changes. */
export function moveOne(c: Counts, level: number, dir: 1 | -1): Counts {
  const from = level - 1;
  const to = from + dir;
  if (to < 0 || to > 4 || c[from] < 1) return c;
  const n = [...c] as Counts;
  n[from]--;
  n[to]++;
  return n;
}

/** Spread every skater evenly from level 1 up, for a first-ever scoring the coach then re-sorts. */
export function evenStart(skaters: number): Counts {
  const c: Counts = [0, 0, 0, 0, 0];
  // Most U7 teams start low: put everyone at levels 2 and 3 and let the coach move them.
  c[1] = Math.ceil(skaters / 2);
  c[2] = skaters - c[1];
  return c;
}

/**
 * Where a coach's scoring of one attribute starts: their own last answer, else the team's last spread
 * (rounded to whole kids), else an even start. Re-sized to this round's team when the team changed.
 */
export function startingCounts(own: Counts | undefined, team: Counts | undefined, skaters: number): Counts {
  const base = own ?? team;
  if (!base || !total(base)) return evenStart(skaters);
  return resize(base, skaters);
}

/** Scale counts to a new total by largest remainder, keeping the shape. */
export function resize(c: Counts, to: number): Counts {
  const n = total(c);
  if (n === to || n === 0) return [...c] as Counts;
  return wholeKids(c.map((x) => (x * to) / n), to);
}

/** Round fractional counts to whole kids that add up to `to` (largest remainder). */
export function wholeKids(xs: number[], to: number): Counts {
  const floors = xs.map(Math.floor);
  let left = to - floors.reduce((a, b) => a + b, 0);
  const order = xs.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]++;
    left--;
  }
  return floors.slice(0, 5) as Counts;
}

export type AttributeReport = {
  attribute: Attribute;
  /** Team score, one decimal: every finished coach's skaters averaged together. */
  score: number | null;
  /** Change from the previous round's score, one decimal, or null. */
  change: number | null;
  /** Kids at each level, averaged across coaches and rounded to whole kids. */
  spread: Counts;
  coaches: { userId: string; name: string; average: number | null }[];
  /** Highest minus lowest coach average, when two or more coaches scored; flagged at 1 level. */
  gap: number | null;
};

export type TeamReport = {
  roundId: string;
  month: string;
  coaches: { userId: string; name: string }[];
  attributes: AttributeReport[];
};

export const GAP_FLAG = 1;

/** The report for a round from its finished coaches. `previous` gives the change column. */
export function teamReport(round: Round, scores: CoachScore[], previous?: TeamReport | null): TeamReport {
  const done = scores.filter((s) => s.roundId === round.id && s.finishedAt);
  const attributes = ATTRIBUTES.map((attribute): AttributeReport => {
    const rows = done.flatMap((s) => (s.answers[attribute] && total(s.answers[attribute]!) ? [{ s, c: s.answers[attribute]! }] : []));
    const sum: Counts = [0, 0, 0, 0, 0];
    rows.forEach(({ c }) => c.forEach((x, i) => (sum[i] += x)));
    const avg = average(sum);
    const score = avg == null ? null : round1(avg);
    const perCoach = rows.length ? sum.map((x) => x / rows.length) : [0, 0, 0, 0, 0];
    const spreadTotal = rows.length ? Math.round(total(sum) / rows.length) : 0;
    const coaches = rows.map(({ s, c }) => ({ userId: s.userId, name: s.name, average: (() => { const a = average(c); return a == null ? null : round1(a); })() }));
    const avgs = coaches.map((c) => c.average).filter((x): x is number => x != null);
    const prev = previous?.attributes.find((a) => a.attribute === attribute)?.score ?? null;
    return {
      attribute,
      score,
      change: score != null && prev != null ? round1(score - prev) : null,
      spread: wholeKids(perCoach, spreadTotal),
      coaches,
      gap: avgs.length >= 2 ? round1(Math.max(...avgs) - Math.min(...avgs)) : null,
    };
  });
  return { roundId: round.id, month: round.month, coaches: done.map((s) => ({ userId: s.userId, name: s.name })), attributes };
}

/** Whether a coach may see the round's report and teammates' answers (decision 0030, P2). */
export const canSeeReport = (scores: CoachScore[], roundId: string, userId: string) => scores.some((s) => s.roundId === roundId && s.userId === userId && s.finishedAt);

/** "November" from "2026-11-01". */
export function monthName(month: string): string {
  return new Date(`${month}T12:00:00Z`).toLocaleString('en-CA', { month: 'long', timeZone: 'UTC' });
}

/** First day of the month a date falls in, Vancouver time: "2026-11-01". */
export function monthOf(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit' }).formatToParts(at);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  return `${y}-${m}-01`;
}
