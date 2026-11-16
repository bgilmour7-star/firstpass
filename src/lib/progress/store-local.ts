import 'server-only';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Practice, Team } from '../plans/schema';
import { practiceOver } from '../plans/checkin';
import { levelSetFor } from './levels';
import { canSeeReport, monthOf, teamReport, total, validCounts, type CoachScore, type Counts, type Round } from './report';
import type { Goal } from './pace';
import type { Attribute } from './levels';
import type { ProgressStore, RoundStatus, ScoreSave, ScoringFlags } from './store';

// Local mode (no Supabase): rounds and scores in .local/progress.json. The same rules as the
// database: a coach sees teammates' scores only once they've finished their own round.

const FILE = join(process.cwd(), '.local', 'progress.json');
type Row = Omit<CoachScore, 'name'> & { teamId: string };
type State = { rounds: Round[]; scores: Row[]; off: { teamId: string; userId: string }[]; emailsOff?: string[]; goals?: (Goal & { teamId: string; endedAt: string | null })[] };

async function read(): Promise<State> {
  try {
    return { rounds: [], scores: [], off: [], ...(JSON.parse(await fs.readFile(FILE, 'utf8')) as Partial<State>) };
  } catch {
    return { rounds: [], scores: [], off: [] };
  }
}
async function write(s: State) {
  await fs.mkdir(join(process.cwd(), '.local'), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(s, null, 2));
}

const LOCAL_USER = 'local';

export class LocalProgressStore implements ProgressStore {
  async rounds(teamId: string) {
    return (await read()).rounds.filter((r) => r.teamId === teamId).sort((a, b) => b.month.localeCompare(a.month));
  }
  async scores(teamId: string) {
    const s = await read();
    const mine = s.scores.filter((r) => r.teamId === teamId);
    return mine.filter((r) => r.userId === LOCAL_USER || canSeeReport(mine.map((x) => ({ ...x, name: '' })), r.roundId, LOCAL_USER)).map(({ teamId: _t, ...r }) => (void _t, r));
  }
  async saveScore(teamId: string, userId: string, x: ScoreSave) {
    const s = await read();
    const round = s.rounds.find((r) => r.id === x.roundId && r.teamId === teamId);
    if (!round) throw new Error('no-round');
    if (round.closedAt) throw new Error('round-closed');
    if (s.off.some((o) => o.teamId === teamId && o.userId === userId)) throw new Error('not-scoring');
    for (const c of Object.values(x.answers)) if (!validCounts(c, round.skaters)) throw new Error('bad-counts');
    const now = new Date().toISOString();
    const prev = s.scores.find((r) => r.roundId === x.roundId && r.userId === userId);
    const row: Row = { roundId: x.roundId, teamId, userId, answers: x.answers, done: x.done, noChange: x.noChange, seconds: x.seconds, startedAt: prev?.startedAt ?? now, finishedAt: prev?.finishedAt ?? (x.finish ? now : null) };
    s.scores = [...s.scores.filter((r) => r !== prev), row];
    await write(s);
  }
  async status(roundId: string): Promise<RoundStatus[]> {
    return (await read()).scores.filter((r) => r.roundId === roundId).map((r) => ({ userId: r.userId, done: r.done.length, finished: Boolean(r.finishedAt) }));
  }
  async scoringFlags(teamId: string): Promise<ScoringFlags> {
    const s = await read();
    return { [LOCAL_USER]: !s.off.some((o) => o.teamId === teamId && o.userId === LOCAL_USER) };
  }
  async setScoring(teamId: string, userId: string, on: boolean) {
    const s = await read();
    s.off = s.off.filter((o) => !(o.teamId === teamId && o.userId === userId));
    if (!on) s.off.push({ teamId, userId });
    await write(s);
  }
  async emailsOn(teamId: string, userId: string) {
    return !(await read()).emailsOff?.includes(`${teamId}:${userId}`);
  }
  async setEmails(teamId: string, userId: string, on: boolean) {
    const s = await read();
    const k = `${teamId}:${userId}`;
    s.emailsOff = [...(s.emailsOff ?? []).filter((x) => x !== k), ...(on ? [] : [k])];
    await write(s);
  }
  async remind(roundId: string) {
    const s = await read();
    s.rounds = s.rounds.map((r) => (r.id === roundId && !r.closedAt ? { ...r, remindAt: r.remindAt ?? new Date().toISOString() } : r));
    await write(s);
  }
  async goals(teamId: string): Promise<Goal[]> {
    return ((await read()).goals ?? []).filter((g) => g.teamId === teamId && !g.endedAt).map(({ teamId: _t, endedAt: _e, ...g }) => (void _t, void _e, g));
  }
  async setGoal(teamId: string, userId: string, g: { attribute: Attribute; target: Counts; byDate: string }) {
    const s = await read();
    const base = s.rounds.filter((r) => r.teamId === teamId && s.scores.some((x) => x.roundId === r.id && x.userId === userId && x.finishedAt)).sort((a, b) => b.month.localeCompare(a.month))[0];
    if (!base) throw new Error('no-report');
    if (!validCounts(g.target, base.skaters) || total(g.target) === 0) throw new Error('bad-target');
    if (g.byDate <= new Date().toISOString().slice(0, 10)) throw new Error('bad-date');
    const start = teamReport(base, s.scores.map((x) => ({ ...x, name: '' }))).attributes.find((a) => a.attribute === g.attribute)?.score;
    if (start == null) throw new Error('no-report');
    const goals = s.goals ?? [];
    if (goals.filter((x) => x.teamId === teamId && !x.endedAt && x.attribute !== g.attribute).length >= 3) throw new Error('too-many-goals');
    const now = new Date().toISOString();
    s.goals = [...goals.map((x) => (x.teamId === teamId && x.attribute === g.attribute && !x.endedAt ? { ...x, endedAt: now } : x)), { id: randomUUID(), teamId, attribute: g.attribute, target: g.target, byDate: g.byDate, baselineRoundId: base.id, baselineScore: start, setAt: now, endedAt: null }];
    await write(s);
  }
  async endGoal(teamId: string, goalId: string) {
    const s = await read();
    s.goals = (s.goals ?? []).map((x) => (x.id === goalId && x.teamId === teamId && !x.endedAt ? { ...x, endedAt: new Date().toISOString() } : x));
    await write(s);
  }
  async recordView() {
    // Local mode keeps no analytics.
  }
  async recordGoalTaken() {
    // Local mode keeps no analytics.
  }
  async openDueRound(team: Team, practices: Practice[], now = new Date()) {
    if (!levelSetFor(team.ageGroup)) return;
    const month = monthOf(now);
    const s = await read();
    if (s.rounds.some((r) => r.teamId === team.id && r.month === month)) return;
    const skaters = team.groups.reduce((a, g) => a + (g.off ? 0 : g.skaters), 0);
    const due = skaters > 0 && practices.some((p) => p.date >= month && p.blocks.length > 0 && practiceOver(p, now));
    if (!due) return;
    const at = now.toISOString();
    s.rounds = s.rounds.map((r) => (r.teamId === team.id && !r.closedAt ? { ...r, closedAt: at } : r));
    s.rounds.push({ id: randomUUID(), teamId: team.id, month, openedAt: at, closedAt: null, levelsVersion: levelSetFor(team.ageGroup)!.version, skaters });
    await write(s);
  }
}
