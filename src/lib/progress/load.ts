import 'server-only';
import { getAppStore } from '../app/store';
import { editorLabel } from '../plans/activity';
import type { Team } from '../plans/schema';
import { ATTRIBUTES, levelSetFor, type Attribute, type LevelSet } from './levels';
import { canSeeReport, startingCounts, teamReport, type Answers, type CoachScore, type Counts, type Round, type TeamReport } from './report';
import { getProgressStore, type RoundStatus } from './store';

// Everything a progress screen needs for one coach on one team (decision 0030).

export type ProgressState =
  | { kind: 'none' } // the team's age group has no level set yet
  | { kind: 'missing' } // the database migration hasn't run
  | {
      kind: 'ready';
      levels: LevelSet;
      rounds: Round[];
      /** The newest round, open or not. */
      current: Round | null;
      open: boolean;
      /** This coach's row in the current round. */
      mine: CoachScore | null;
      /** Visible scores with first names. */
      scores: CoachScore[];
      status: RoundStatus[];
      /** Whether this coach scores (head coach can turn a helper off). */
      scoring: boolean;
      coaches: { userId: string; name: string }[];
      skaters: number;
      isHead: boolean;
    };

export async function progressState(team: Team, userId: string): Promise<ProgressState> {
  const levels = levelSetFor(team.ageGroup);
  if (!levels) return { kind: 'none' };
  const [ps, app] = await Promise.all([getProgressStore(), getAppStore()]);
  await ps.openDueRound(team, await app.listPractices(team.id).catch(() => []));
  const rounds = await ps.rounds(team.id);
  if (rounds === null) return { kind: 'missing' };
  const [raw, flags, teamCoaches] = await Promise.all([ps.scores(team.id), ps.scoringFlags(team.id), app.coaches(team.id).catch(() => [])]);
  const names = new Map(teamCoaches.map((c) => [c.userId, c.firstName?.trim() || editorLabel(c.email)]));
  const nameOf = (id: string) => names.get(id) ?? (id === 'local' ? 'You' : 'A coach');
  const scores = raw.map((s) => ({ ...s, name: nameOf(s.userId) }));
  const current = rounds[0] ?? null;
  const status = current ? await ps.status(current.id) : [];
  const coaches = teamCoaches.length ? teamCoaches.filter((c) => flags[c.userId] !== false).map((c) => ({ userId: c.userId, name: nameOf(c.userId) })) : [{ userId, name: 'You' }];
  const skaters = team.groups.reduce((a, g) => a + (g.off ? 0 : g.skaters), 0);
  return {
    kind: 'ready',
    levels,
    rounds,
    current,
    open: Boolean(current && !current.closedAt),
    mine: current ? (scores.find((s) => s.roundId === current.id && s.userId === userId) ?? null) : null,
    scores,
    status,
    scoring: flags[userId] !== false,
    coaches,
    skaters,
    isHead: userId === 'local' || teamCoaches.some((c) => c.userId === userId && c.role === 'head_coach'),
  };
}

/** The report for a round, with the change from the round before it (from what this coach can see). */
export function reportFor(rounds: Round[], scores: CoachScore[], roundId: string): TeamReport | null {
  const i = rounds.findIndex((r) => r.id === roundId);
  if (i < 0) return null;
  const prevRound = rounds[i + 1];
  const prev = prevRound ? teamReport(prevRound, scores) : null;
  return teamReport(rounds[i], scores, prev);
}

export const visible = (scores: CoachScore[], roundId: string, userId: string) => canSeeReport(scores, roundId, userId);

/**
 * Where this coach starts each attribute: their answer so far this round, else their own answer in
 * the last round they finished, else last round's team spread, else an even start to re-sort.
 */
export function startingAnswers(state: Extract<ProgressState, { kind: 'ready' }>, userId: string): { answers: Record<Attribute, Counts>; before: Answers; first: boolean } {
  const cur = state.current!;
  const lastMine = state.scores.filter((s) => s.userId === userId && s.roundId !== cur.id && s.finishedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const prevRound = state.rounds.find((r) => r.id !== cur.id && state.scores.some((s) => s.roundId === r.id && s.finishedAt));
  const prevReport = prevRound ? teamReport(prevRound, state.scores) : null;
  const before: Answers = {};
  const answers = {} as Record<Attribute, Counts>;
  for (const a of ATTRIBUTES) {
    const own = lastMine?.answers[a];
    const team = prevReport?.attributes.find((x) => x.attribute === a)?.spread;
    const prior = own ?? (team && team.some((n) => n > 0) ? team : undefined);
    if (prior) before[a] = startingCounts(prior, undefined, cur.skaters);
    answers[a] = state.mine?.answers[a] ?? startingCounts(own, team && team.some((n) => n > 0) ? team : undefined, cur.skaters);
  }
  return { answers, before, first: !lastMine && !prevReport };
}
