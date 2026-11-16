// Admin → Analytics → Progress scoring (decision 0030, part E): is the monthly report sticking?
// Pure. Works from progress_usage(month): ids, counts and team names, never a coach's name.

import { ATTRIBUTES, type Attribute } from './levels';
import { pace, type Goal } from './pace';
import { teamReport, type Answers, type CoachScore } from './report';

export type ProgressUsageRows = {
  teams: { id: string; name: string; lastPlanAt: string | null }[];
  members: { teamId: string; userId: string; role: 'head_coach' | 'coach'; scores: boolean }[];
  rounds: { id: string; teamId: string; month: string; skaters: number }[];
  scores: { roundId: string; teamId: string; userId: string; finished: boolean; seconds: number | null; done: number; noChange: number; answers: Answers | null }[];
  goals: { teamId: string; attribute: Attribute; target: number[]; byDate: string; baselineRoundId: string; baselineScore: number | string; setAt: string }[];
  emailed: { roundId: string; userId: string }[];
  views: { roundId: string; userId: string }[];
  taken: { teamId: string; key: string }[];
  kept: { teamId: string; key: string }[];
  months: string[];
};

export const EMPTY_PROGRESS_USAGE: ProgressUsageRows = { teams: [], members: [], rounds: [], scores: [], goals: [], emailed: [], views: [], taken: [], kept: [], months: [] };

export type Of = { n: number; of: number };
export type TeamLine = { id: string; name: string; scored: Of; again: Of; goals: number; behind: number; taken: Of; lastPlanAt: string | null };

export type ProgressUsage = {
  month: string;
  teams: number;
  coaches: number;
  again: Of;
  taken: Of;
  stillPlanning: { scoring: Of; others: Of };
  scored: Of & { head: Of; assistants: Of };
  medianSeconds: number | null;
  noChange: number | null;
  withGoal: Of & { goals: number; behind: number };
  medianGap: number | null;
  funnel: { emailed: number; started: number; finished: number; viewed: number; finishedWithoutEmail: number };
  byTeam: TeamLine[];
};

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const prevMonth = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return mo === 1 ? `${y - 1}-12-01` : `${y}-${String(mo - 1).padStart(2, '0')}-01`;
};

/** `now` for "still planning in the last 14 days". */
export function summarizeProgress(r: ProgressUsageRows, month: string, now = new Date()): ProgressUsage {
  const prev = prevMonth(month);
  const cur = r.rounds.filter((x) => x.month === month);
  const before = r.rounds.filter((x) => x.month === prev);
  const curIds = new Set(cur.map((x) => x.id));
  const teamIds = new Set(cur.map((x) => x.teamId));
  const teams = r.teams.filter((t) => teamIds.has(t.id));
  const scorers = r.members.filter((m) => teamIds.has(m.teamId) && m.scores);
  const finishedIn = (ids: Set<string>) => new Set(r.scores.filter((s) => ids.has(s.roundId) && s.finished).map((s) => `${s.teamId}:${s.userId}`));
  const doneNow = finishedIn(curIds);
  const doneBefore = finishedIn(new Set(before.map((x) => x.id)));
  const key = (m: { teamId: string; userId: string }) => `${m.teamId}:${m.userId}`;
  const of = (xs: { teamId: string; userId: string }[], set: Set<string>): Of => ({ n: xs.filter((x) => set.has(key(x))).length, of: xs.length });

  // Scored again: of those who finished last month (and are still on the team), how many finished this month.
  const lastTime = scorers.filter((m) => doneBefore.has(key(m)));
  const again = of(lastTime, doneNow);

  const goalKey = (k: string) => k.startsWith('goal:');
  const takenN = r.taken.filter((x) => teamIds.has(x.teamId) && goalKey(x.key)).length;
  const keptN = r.kept.filter((x) => teamIds.has(x.teamId) && goalKey(x.key)).length;

  const fortnight = now.getTime() - 14 * 86_400_000;
  const planning = (t: { lastPlanAt: string | null }) => !!t.lastPlanAt && Date.parse(t.lastPlanAt) >= fortnight;
  const scoringTeams = new Set(r.scores.filter((s) => curIds.has(s.roundId) && s.finished).map((s) => s.teamId));
  const others = r.teams.filter((t) => !scoringTeams.has(t.id));

  const finished = r.scores.filter((s) => curIds.has(s.roundId) && s.finished);
  const allDone = finished.reduce((a, s) => a + s.done, 0);
  const allNoChange = finished.reduce((a, s) => a + s.noChange, 0);

  // Goals: active ones on this month's teams, and how many are behind on this month's report.
  const reports = new Map(cur.map((round) => [round.teamId, teamReport({ id: round.id, teamId: round.teamId, month: round.month, openedAt: '', closedAt: null, levelsVersion: '', skaters: round.skaters }, finished.filter((s) => s.roundId === round.id).map((s) => asScore(s)))]));
  const goals = r.goals.filter((g) => teamIds.has(g.teamId));
  const behindBy = new Map<string, number>();
  for (const g of goals) {
    const rep = reports.get(g.teamId);
    const now = rep?.attributes.find((a) => a.attribute === g.attribute)?.score ?? null;
    const base = r.rounds.find((x) => x.id === g.baselineRoundId)?.month ?? month;
    const skaters = cur.find((x) => x.teamId === g.teamId)?.skaters ?? 0;
    const p = pace(asGoal(g), { month: base, score: Number(g.baselineScore) }, base < month ? { month, score: now } : null, skaters);
    if (p.status === 'behind') behindBy.set(g.teamId, (behindBy.get(g.teamId) ?? 0) + 1);
  }
  const gaps = [...reports.values()].flatMap((rep) => {
    const gs = rep.attributes.map((a) => a.gap).filter((x): x is number => x != null);
    return gs.length ? [Math.max(...gs)] : [];
  });

  const emailed = new Set(r.emailed.filter((e) => curIds.has(e.roundId)).map((e) => `${e.roundId}:${e.userId}`));
  const started = r.scores.filter((s) => curIds.has(s.roundId));
  const viewed = r.views.filter((v) => curIds.has(v.roundId));

  const byTeam: TeamLine[] = teams
    .map((t) => {
      const mem = scorers.filter((m) => m.teamId === t.id);
      const last = mem.filter((m) => doneBefore.has(key(m)));
      const gs = goals.filter((g) => g.teamId === t.id);
      const tk = r.taken.filter((x) => x.teamId === t.id && goalKey(x.key)).length;
      const kp = r.kept.filter((x) => x.teamId === t.id && goalKey(x.key)).length;
      return { id: t.id, name: t.name, scored: of(mem, doneNow), again: of(last, doneNow), goals: gs.length, behind: behindBy.get(t.id) ?? 0, taken: { n: tk, of: tk + kp }, lastPlanAt: t.lastPlanAt };
    })
    .sort((a, b) => b.scored.n - a.scored.n || a.name.localeCompare(b.name));

  const heads = scorers.filter((m) => m.role === 'head_coach');
  const assistants = scorers.filter((m) => m.role !== 'head_coach');
  return {
    month,
    teams: teams.length,
    coaches: scorers.length,
    again,
    taken: { n: takenN, of: takenN + keptN },
    stillPlanning: { scoring: { n: r.teams.filter((t) => scoringTeams.has(t.id) && planning(t)).length, of: scoringTeams.size }, others: { n: others.filter(planning).length, of: others.length } },
    scored: { ...of(scorers, doneNow), head: of(heads, doneNow), assistants: of(assistants, doneNow) },
    medianSeconds: median(finished.flatMap((s) => (s.seconds != null ? [s.seconds] : []))),
    noChange: allDone ? allNoChange / allDone : null,
    withGoal: { n: new Set(goals.map((g) => g.teamId)).size, of: teams.length, goals: goals.length, behind: [...behindBy.values()].reduce((a, b) => a + b, 0) },
    medianGap: median(gaps),
    funnel: {
      emailed: emailed.size,
      started: started.length,
      finished: finished.length,
      viewed: viewed.length,
      finishedWithoutEmail: finished.filter((s) => !emailed.has(`${s.roundId}:${s.userId}`)).length,
    },
    byTeam,
  };
}

function asScore(s: ProgressUsageRows['scores'][number]): CoachScore {
  return { roundId: s.roundId, userId: s.userId, name: '', answers: s.answers ?? {}, done: [], noChange: [], startedAt: '', finishedAt: s.finished ? 'x' : null, seconds: s.seconds };
}
function asGoal(g: ProgressUsageRows['goals'][number]): Goal {
  return { id: '', attribute: g.attribute, target: g.target as Goal['target'], byDate: g.byDate, baselineRoundId: g.baselineRoundId, baselineScore: Number(g.baselineScore), setAt: g.setAt };
}

/** "2:10" */
export const minSec = (s: number | null) => (s == null ? '–' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);
export { ATTRIBUTES };
