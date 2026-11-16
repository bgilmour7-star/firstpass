// Progress over the season (decision 0030, part D): every report this coach has unlocked, side by
// side, with the goals' lines, what practices worked on each month, and how closely coaches agreed.
// Pure: built from the same rounds, scores, goals and practices as the report.

import type { Drill } from '../drills/schema';
import { practiceFocus, type Practice } from '../plans/schema';
import { timeShares } from './ice-time';
import { ATTRIBUTES, type Attribute } from './levels';
import { expectedAt, goalScore, pace, STATUS_WORDS, type Goal, type Status } from './pace';
import { canSeeReport, monthName, round1, teamReport, type CoachScore, type Round, type TeamReport } from './report';

export type SeasonMonth = { roundId: string; month: string; label: string; opened: string; coaches: number; report: TeamReport };

export type SeasonGoal = {
  goal: Goal;
  target: number;
  /** Months from the goal's starting month on, with the score and where the line expected it. */
  points: { month: string; label: string; score: number | null; expected: number; status: Status | null }[];
  /** The latest status, in words, and whether it's a warning. */
  status: string | null;
  warn: boolean;
  /** Share of drill time by month for this skill, as whole percents (null: no practices that month). */
  ice: (number | null)[];
};

export type Season = {
  months: SeasonMonth[];
  rows: { attribute: Attribute; scores: (number | null)[]; change: number | null; share: number | null; goal: boolean }[];
  goals: SeasonGoal[];
  /** Per month: 2 main, 1 some, 0 not trained, null no practices. */
  focus: { attribute: Attribute; levels: (0 | 1 | 2 | null)[] }[];
  /** Per month: the biggest gap between coaches, and the skill(s) it was on. */
  gaps: { gap: number | null; on: Attribute[] }[];
  /** One line per report for the list. */
  notes: string[];
  practices: number;
};

const monthKey = (date: string) => `${date.slice(0, 7)}-01`;
const short = (month: string) => monthName(month).slice(0, 3);

/** `rounds` newest first, as the store gives them. `today` YYYY-MM-DD. */
export function season(rounds: Round[], scores: CoachScore[], userId: string, goals: Goal[], practices: Pick<Practice, 'date' | 'blocks'>[], byId: Map<string, Pick<Drill, 'focus'>>, today: string, groupCount = 3): Season {
  const seen = [...rounds].filter((r) => canSeeReport(scores, r.id, userId)).sort((a, b) => a.month.localeCompare(b.month));
  const months: SeasonMonth[] = seen.map((r, i) => {
    const prev = i > 0 ? teamReport(seen[i - 1], scores) : null;
    const report = teamReport(r, scores, prev);
    return { roundId: r.id, month: r.month, label: short(r.month), opened: r.openedAt, coaches: report.coaches.length, report };
  });
  const scoreIn = (m: SeasonMonth, a: Attribute) => m.report.attributes.find((x) => x.attribute === a)?.score ?? null;

  // Practices that happened, from the first report's month, grouped by month.
  const first = months[0]?.month ?? today;
  const ran = practices.filter((p) => p.date >= first && p.date <= today && p.blocks.length);
  const byMonth = new Map<string, typeof ran>();
  for (const p of ran) byMonth.set(monthKey(p.date), [...(byMonth.get(monthKey(p.date)) ?? []), p]);
  const seasonShare = ran.length ? timeShares(ran, byId, groupCount) : null;

  const goalAttrs = new Set(goals.map((g) => g.attribute));
  const rows = ATTRIBUTES.map((a) => {
    const s = months.map((m) => scoreIn(m, a));
    const known = s.filter((x): x is number => x != null);
    return { attribute: a, scores: s, change: known.length >= 2 ? round1(known[known.length - 1] - known[0]) : null, share: seasonShare ? Math.round(seasonShare[a] * 100) : null, goal: goalAttrs.has(a) };
  });

  const seasonGoals: SeasonGoal[] = goals.map((g) => {
    const target = goalScore(g.target);
    const startMonth = rounds.find((r) => r.id === g.baselineRoundId)?.month ?? monthKey(g.setAt);
    const from = { score: g.baselineScore, date: startMonth };
    const to = { score: target, date: g.byDate };
    const skaters = rounds[0]?.skaters ?? 0;
    const points = months
      .filter((m) => m.month >= startMonth)
      .map((m) => {
        const score = m.month === startMonth ? g.baselineScore : scoreIn(m, g.attribute);
        const p = score == null ? null : pace(g, { month: startMonth, score: g.baselineScore }, { month: m.month, score }, skaters);
        return { month: m.month, label: m.label, score, expected: expectedAt(from, to, m.month), status: m.month === startMonth ? null : (p?.status ?? null) };
      });
    const last = [...points].reverse().find((p) => p.status);
    const ice = months.map((m) => {
      const ps = byMonth.get(m.month);
      return ps?.length ? Math.round(timeShares(ps, byId, groupCount)[g.attribute] * 100) : null;
    });
    return { goal: g, target, points, status: last?.status ? STATUS_WORDS[last.status] : null, warn: last?.status === 'behind' || last?.status === 'short', ice };
  });

  const focus = ATTRIBUTES.map((a) => ({
    attribute: a,
    levels: months.map((m) => {
      const ps = byMonth.get(m.month);
      if (!ps?.length) return null;
      // A month's focus: the same Main / Some ranking practiceFocus gives one plan, over the month's drills.
      const f = practiceFocus(ps.flatMap((p) => p.blocks), byId, groupCount).find((x) => x.attribute === a);
      return (f?.level ?? 0) as 0 | 1 | 2;
    }),
  }));

  const gaps = months.map((m) => {
    const gs = m.report.attributes.filter((x) => x.gap != null);
    if (!gs.length) return { gap: null, on: [] };
    const top = Math.max(...gs.map((x) => x.gap!));
    return { gap: top, on: gs.filter((x) => x.gap === top).map((x) => x.attribute) };
  });

  const notes = months.map((m, i) => {
    const started = goals.filter((g) => rounds.find((r) => r.id === g.baselineRoundId)?.month === m.month);
    if (started.length) return i === 0 ? 'Starting point · goals set' : 'Goals set';
    const st = seasonGoals.flatMap((g) => {
      const p = g.points.find((x) => x.month === m.month);
      return p?.status ? [{ a: g.goal.attribute, s: p.status }] : [];
    });
    const bad = st.find((x) => x.s === 'behind' || x.s === 'short');
    if (bad) return `${bad.a} ${STATUS_WORDS[bad.s].charAt(0).toLowerCase()}${STATUS_WORDS[bad.s].slice(1)}`;
    const reached = st.find((x) => x.s === 'reached');
    if (reached) return `${reached.a} goal reached`;
    if (st.length > 1 && st.every((x) => x.s === 'on-pace' || x.s === 'ahead')) return st.length === 2 ? 'Both on pace' : 'All on pace';
    if (st.length === 1) return `${st[0].a} ${STATUS_WORDS[st[0].s].toLowerCase()}`;
    if (i === 0) return 'Starting point';
    // No goals: the biggest move.
    const moves = m.report.attributes.filter((x) => x.change != null).sort((x, y) => Math.abs(y.change!) - Math.abs(x.change!));
    const mv = moves[0];
    return mv && mv.change ? `${mv.attribute} ${mv.change > 0 ? 'up' : 'down'} ${Math.abs(mv.change).toFixed(1)}` : 'About the same';
  });

  return { months, rows, goals: seasonGoals, focus, gaps, notes, practices: ran.length };
}
