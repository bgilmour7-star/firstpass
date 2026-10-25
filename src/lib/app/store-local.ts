import 'server-only';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { drillIds, practiceSchema, teamSchema, type Practice, type Team } from '../plans/schema';
import { drillSchema, type Drill } from '../drills/schema';
import type { PracticeActivity, Snapshot } from '../plans/activity';
import type { Checkin } from '../plans/checkin';
import { newShareToken, type AppStore, type IceTime, type IceTimeRow, type MyTeam, type NewPractice, type OlderInterest, type Share, type SharedPractice, type TeamCoach, type TeamSetup, type Favorite } from './store';

const FILE = join(process.cwd(), '.local', 'app.json');
type ShareRow = { token: string; practiceId: string; teamId: string; expiresAt: string; revokedAt: string | null };
type EditRow = { id: string; practiceId: string; teamId: string; userId: string; editor: string; summary: string; base: Snapshot | null; at: string };
type State = { kept?: { practiceId: string; key: string; editor: string; at: string }[]; favorites?: Record<string, Record<string, Favorite>>; joinCodes?: Record<string, string>; emailsOff?: string[]; checkins?: Checkin[]; edits?: EditRow[]; views?: Record<string, string>; older?: (OlderInterest & { userId: string; at: string })[]; teams: Team[]; members: { teamId: string; userId: string; role: string; at?: string }[]; practices: Practice[]; shares?: ShareRow[]; calendars?: Record<string, { url: string; syncedAt: string | null }>; iceTimes?: IceTime[] };

async function read(): Promise<State> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8')) as State;
  } catch {
    return { teams: [], members: [], practices: [] };
  }
}
async function write(s: State) {
  await fs.mkdir(join(process.cwd(), '.local'), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(s, null, 2));
}

/** Memberships newest first: by join time, then by the order they were added (older files have no times). */
function newestFirst<T extends { at?: string }>(rows: T[]): T[] {
  return rows
    .map((m, i) => ({ m, i }))
    .sort((a, b) => (b.m.at ?? '').localeCompare(a.m.at ?? '') || b.i - a.i)
    .map((x) => x.m);
}

export class LocalAppStore implements AppStore {
  async myTeams(userId: string): Promise<MyTeam[]> {
    const s = await read();
    return newestFirst(s.members.filter((m) => m.userId === userId)).flatMap((m) => {
      const t = s.teams.find((x) => x.id === m.teamId);
      return t ? [{ ...teamSchema.parse(t), role: m.role === 'head_coach' ? ('head_coach' as const) : ('coach' as const) }] : [];
    });
  }
  async myTeam(userId: string, teamId?: string) {
    const teams = await this.myTeams(userId);
    const t = teamId ? teams.find((x) => x.id === teamId) : teams[0];
    if (!t) return null;
    const { role: _r, ...team } = t;
    void _r;
    return team;
  }
  async createTeam(name: string, userId: string, setup: TeamSetup = {}) {
    const s = await read();
    const team = teamSchema.parse({
      id: randomUUID(),
      name,
      ageGroup: 'U7',
      groups: [
        { group: 'Eagles', skaters: 4 },
        { group: 'Bears', skaters: 4 },
        { group: 'Sharks', skaters: 4 },
      ],
      coachesOnIce: 3,
      practiceMinutes: 60,
      ice: 'half',
      newDrillsPerWeek: 2,
      ...setup,
    });
    s.teams.push(team);
    s.members.push({ teamId: team.id, userId, role: 'head_coach', at: new Date().toISOString() });
    await write(s);
    return team;
  }
  async leaveTeam(teamId: string, userId: string) {
    const s = await read();
    const m = s.members.find((x) => x.teamId === teamId && x.userId === userId);
    if (m?.role === 'head_coach') throw new Error('head-coach-leaves');
    s.members = s.members.filter((x) => !(x.teamId === teamId && x.userId === userId));
    await write(s);
  }
  async handOverTeam(teamId: string, fromUserId: string, toUserId: string) {
    const s = await read();
    const from = s.members.find((m) => m.teamId === teamId && m.userId === fromUserId);
    if (from?.role !== 'head_coach') throw new Error('not-head-coach');
    if (toUserId === fromUserId) return;
    const to = s.members.find((m) => m.teamId === teamId && m.userId === toUserId);
    if (!to) throw new Error('not-on-team');
    // Both change together, so the team always has exactly one head coach.
    from.role = 'coach';
    to.role = 'head_coach';
    await write(s);
  }
  async deleteTeam(teamId: string) {
    const s = await read();
    s.teams = s.teams.filter((t) => t.id !== teamId);
    s.members = s.members.filter((m) => m.teamId !== teamId);
    s.practices = s.practices.filter((p) => p.teamId !== teamId);
    s.iceTimes = (s.iceTimes ?? []).filter((x) => x.teamId !== teamId);
    s.checkins = (s.checkins ?? []).filter((c) => c.teamId !== teamId);
    if (s.calendars) delete s.calendars[teamId];
    if (s.joinCodes) delete s.joinCodes[teamId];
    if (s.favorites) delete s.favorites[teamId];
    await write(s);
  }
  async saveOlderInterest(userId: string, answer: OlderInterest) {
    const s = await read();
    (s.older ??= []).push({ ...answer, userId, at: new Date().toISOString() });
    await write(s);
  }
  async updateTeam(team: Team) {
    const s = await read();
    s.teams = s.teams.map((t) => (t.id === team.id ? teamSchema.parse(team) : t));
    await write(s);
  }
  async listPractices(teamId: string) {
    return (await read()).practices.filter((p) => p.teamId === teamId).map((p) => practiceSchema.parse(p)).sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
  }
  async getPractice(id: string) {
    const p = (await read()).practices.find((x) => x.id === id);
    return p ? practiceSchema.parse(p) : null;
  }
  async createPractice(p: NewPractice) {
    const s = await read();
    const practice = practiceSchema.parse({ ...p, id: randomUUID() });
    s.practices.push(practice);
    await write(s);
    return practice;
  }
  async savePractice(p: Practice) {
    const s = await read();
    s.practices = s.practices.map((x) => (x.id === p.id ? practiceSchema.parse(p) : x));
    await write(s);
  }
  async deletePractice(id: string) {
    const s = await read();
    s.practices = s.practices.filter((x) => x.id !== id);
    await write(s);
  }
  async libraryDrills(): Promise<Drill[]> {
    const dir = join(process.cwd(), 'content', 'drills');
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
    const all = await Promise.all(files.map(async (f) => drillSchema.safeParse(JSON.parse(await fs.readFile(join(dir, f), 'utf8')))));
    return all.filter((r) => r.success).map((r) => r.data!);
  }

  async activeShare(practiceId: string): Promise<Share | null> {
    const now = new Date().toISOString();
    const r = ((await read()).shares ?? []).find((x) => x.practiceId === practiceId && !x.revokedAt && x.expiresAt > now);
    return r ? { token: r.token, expiresAt: r.expiresAt } : null;
  }
  async createShare(practiceId: string, teamId: string): Promise<Share> {
    const s = await read();
    const row: ShareRow = { token: newShareToken(), practiceId, teamId, expiresAt: new Date(Date.now() + 30 * 864e5).toISOString(), revokedAt: null };
    s.shares = [...(s.shares ?? []), row];
    await write(s);
    return { token: row.token, expiresAt: row.expiresAt };
  }
  async revokeShares(practiceId: string) {
    const s = await read();
    s.shares = (s.shares ?? []).map((x) => (x.practiceId === practiceId && !x.revokedAt ? { ...x, revokedAt: new Date().toISOString() } : x));
    await write(s);
  }
  async sharedPractice(token: string): Promise<SharedPractice | null> {
    const s = await read();
    const now = new Date().toISOString();
    const share = (s.shares ?? []).find((x) => x.token === token && !x.revokedAt && x.expiresAt > now);
    const p = share && s.practices.find((x) => x.id === share.practiceId);
    const team = p && s.teams.find((t) => t.id === p.teamId);
    if (!p || !team) return null;
    const parsed = practiceSchema.parse(p);
    const used = new Set(parsed.blocks.flatMap(drillIds));
    return {
      team: team.name,
      groups: team.groups,
      practice: { date: parsed.date, startTime: parsed.startTime, minutes: parsed.minutes, ice: parsed.ice, blocks: parsed.blocks, attendance: parsed.attendance },
      drills: (await this.libraryDrills()).filter((d) => used.has(d.id)),
    };
  }

  async calendar(teamId: string) {
    return (await read()).calendars?.[teamId] ?? null;
  }
  async setCalendar(teamId: string, url: string | null) {
    const s = await read();
    s.calendars = { ...(s.calendars ?? {}) };
    if (url) s.calendars[teamId] = { url, syncedAt: null };
    else {
      delete s.calendars[teamId];
      s.iceTimes = (s.iceTimes ?? []).filter((x) => x.teamId !== teamId || x.practiceId);
    }
    await write(s);
  }
  async markCalendarSynced(teamId: string, at: string) {
    const s = await read();
    if (s.calendars?.[teamId]) s.calendars[teamId].syncedAt = at;
    await write(s);
  }
  async iceTimes(teamId: string) {
    return ((await read()).iceTimes ?? []).filter((x) => x.teamId === teamId).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  }
  async upsertIceTimes(teamId: string, rows: IceTimeRow[]) {
    const s = await read();
    const all = s.iceTimes ?? [];
    for (const r of rows) {
      const i = all.findIndex((x) => x.teamId === teamId && x.uid === r.uid);
      if (i >= 0) all[i] = { ...all[i], ...r };
      else all.push({ ...r, id: randomUUID(), teamId });
    }
    s.iceTimes = all;
    await write(s);
  }
  async setIceTime(id: string, patch: { ignored?: boolean; practiceId?: string | null }) {
    const s = await read();
    s.iceTimes = (s.iceTimes ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x));
    await write(s);
  }

  async latestEdit(practiceId: string) {
    const e = ((await read()).edits ?? []).filter((x) => x.practiceId === practiceId).sort((a, b) => b.at.localeCompare(a.at))[0];
    return e ? { id: e.id, userId: e.userId, at: e.at, base: e.base } : null;
  }
  async addEdit(e: { practiceId: string; teamId: string; userId: string; editor: string; summary: string; base: Snapshot | null }) {
    const s = await read();
    (s.edits ??= []).push({ ...e, id: randomUUID(), at: new Date().toISOString() });
    await write(s);
  }
  async updateEdit(id: string, patch: { summary: string; at: string }) {
    const s = await read();
    s.edits = (s.edits ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x));
    await write(s);
  }
  async markViewed(practiceId: string, userId: string) {
    const s = await read();
    (s.views ??= {})[`${practiceId}:${userId}`] = new Date().toISOString();
    await write(s);
  }
  async teamActivity(teamId: string, userId: string) {
    const s = await read();
    const out: Record<string, PracticeActivity> = {};
    for (const e of (s.edits ?? []).filter((x) => x.teamId === teamId).sort((a, b) => b.at.localeCompare(a.at)))
      (out[e.practiceId] ??= { edits: [], viewedAt: s.views?.[`${e.practiceId}:${userId}`] ?? null }).edits.push({ userId: e.userId, editor: e.editor, summary: e.summary, at: e.at });
    return out;
  }

  async teamCheckins(teamId: string) {
    return ((await read()).checkins ?? []).filter((c) => c.teamId === teamId);
  }
  async saveCheckin(c: Checkin) {
    const s = await read();
    s.checkins = [...(s.checkins ?? []).filter((x) => !(x.practiceId === c.practiceId && x.userId === c.userId)), c];
    await write(s);
  }
  async keptSuggestions(practiceId: string) {
    return ((await read()).kept ?? []).filter((k) => k.practiceId === practiceId).map(({ key, editor, at }) => ({ key, editor, at }));
  }
  async keepSuggestion(k: { practiceId: string; teamId: string; userId: string; editor: string; key: string }) {
    const s = await read();
    if ((s.kept ?? []).some((x) => x.practiceId === k.practiceId && x.key === k.key)) return;
    s.kept = [...(s.kept ?? []), { practiceId: k.practiceId, key: k.key, editor: k.editor, at: new Date().toISOString() }];
    await write(s);
  }
  async coachCount(teamId: string) {
    return Math.max(1, (await read()).members.filter((m) => m.teamId === teamId).length);
  }

  async checkinEmails(teamId: string, userId: string) {
    return !((await read()).emailsOff ?? []).includes(`${teamId}:${userId}`);
  }
  async setCheckinEmails(teamId: string, userId: string, on: boolean) {
    const s = await read();
    const key = `${teamId}:${userId}`;
    s.emailsOff = (s.emailsOff ?? []).filter((k) => k !== key).concat(on ? [] : [key]);
    await write(s);
  }

  async coaches(teamId: string): Promise<TeamCoach[]> {
    return (await read()).members
      .filter((m) => m.teamId === teamId)
      .map((m) => ({ userId: m.userId, email: m.userId === 'local' ? 'Local coach' : m.userId, firstName: m.userId === 'local' ? 'Coach' : null, role: m.role === 'head_coach' ? 'head_coach' : 'coach', joinedAt: '' }));
  }
  async joinCode(teamId: string) {
    return (await read()).joinCodes?.[teamId] ?? null;
  }
  async newJoinCode(teamId: string) {
    const s = await read();
    const code = randomUUID().replace(/-/g, '').slice(0, 24);
    s.joinCodes = { ...(s.joinCodes ?? {}), [teamId]: code };
    await write(s);
    return code;
  }
  async turnOffJoinCode(teamId: string) {
    const s = await read();
    if (s.joinCodes) delete s.joinCodes[teamId];
    await write(s);
  }
  async joinCodeTeam(code: string) {
    const s = await read();
    const id = Object.entries(s.joinCodes ?? {}).find(([, c]) => c === code)?.[0];
    const team = s.teams.find((t) => t.id === id);
    if (!team) return null;
    const today = new Date().toISOString().slice(0, 10);
    const next = s.practices.filter((p) => p.teamId === team.id && p.date >= today && p.blocks.length).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0];
    return { id: team.id, name: team.name, inviter: 'Coach', next: next ? { date: next.date, startTime: next.startTime, ice: next.ice, blocks: next.blocks.length } : null };
  }
  async joinTeam(code: string, userId: string) {
    const s = await read();
    const id = Object.entries(s.joinCodes ?? {}).find(([, c]) => c === code)?.[0];
    if (!id) throw new Error('link-off');
    if (s.members.some((m) => m.userId === userId && m.teamId === id)) return id;
    // A coach can be on several teams (decision 0026).
    s.members.push({ teamId: id, userId, role: 'coach', at: new Date().toISOString() });
    await write(s);
    return id;
  }
  async removeCoach(teamId: string, userId: string) {
    const s = await read();
    s.members = s.members.filter((m) => !(m.teamId === teamId && m.userId === userId && m.role !== 'head_coach'));
    await write(s);
  }

  async favorites(teamId: string) {
    return (await read()).favorites?.[teamId] ?? {};
  }
  async setFavorite(teamId: string, _userId: string, editor: string, drillId: string, on: boolean) {
    const s = await read();
    const team = { ...(s.favorites?.[teamId] ?? {}) };
    if (on) team[drillId] ??= { by: editor, at: new Date().toISOString() };
    else delete team[drillId];
    s.favorites = { ...(s.favorites ?? {}), [teamId]: team };
    await write(s);
  }
}
