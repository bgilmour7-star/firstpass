import 'server-only';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { practiceSchema, teamSchema, type Practice, type Team } from '../plans/schema';
import { drillSchema, type Drill } from '../drills/schema';
import type { AppStore, NewPractice } from './store';

const FILE = join(process.cwd(), '.local', 'app.json');
type State = { teams: Team[]; members: { teamId: string; userId: string; role: string }[]; practices: Practice[] };

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
    return (await read()).practices.filter((p) => p.teamId === teamId).sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
  }
  async getPractice(id: string) {
    return (await read()).practices.find((p) => p.id === id) ?? null;
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
}
