import 'server-only';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { drillIds, practiceSchema, teamSchema, type Practice, type Team } from '../plans/schema';
import { drillSchema, type Drill } from '../drills/schema';
import type { PracticeActivity, Snapshot } from '../plans/activity';
import type { Checkin } from '../plans/checkin';
import { newShareToken, type AppStore, type IceTime, type IceTimeRow, type NewPractice, type Share, type SharedPractice } from './store';

const FILE = join(process.cwd(), '.local', 'app.json');
type ShareRow = { token: string; practiceId: string; teamId: string; expiresAt: string; revokedAt: string | null };
type EditRow = { id: string; practiceId: string; teamId: string; userId: string; editor: string; summary: string; base: Snapshot | null; at: string };
type State = { emailsOff?: string[]; checkins?: Checkin[]; edits?: EditRow[]; views?: Record<string, string>; teams: Team[]; members: { teamId: string; userId: string; role: string }[]; practices: Practice[]; shares?: ShareRow[]; calendars?: Record<string, { url: string; syncedAt: string | null }>; iceTimes?: IceTime[] };

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

export class LocalAppStore implements AppStore {
  async myTeam(userId: string) {
    const s = await read();
    const m = s.members.find((x) => x.userId === userId);
    return m ? (s.teams.find((t) => t.id === m.teamId) ?? null) : null;
  }
  async createTeam(name: string, userId: string) {
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
    });
    s.teams.push(team);
    s.members.push({ teamId: team.id, userId, role: 'head_coach' });
    await write(s);
    return team;
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
}
