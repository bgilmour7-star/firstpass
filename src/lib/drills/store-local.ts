import 'server-only';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { drillSchema, type DiagramRequest, type Drill, type ReviewNote, type Status } from './schema';
import type { DrillDetail, DrillStore, DrillSummary } from './store';

// Local development store: drills live in content/drills/*.json (the same files the
// Supabase seed uses), review activity in .local/review.json (git-ignored).

const CONTENT = join(process.cwd(), 'content', 'drills');
const STATE = join(process.cwd(), '.local', 'review.json');

type State = { requests: DiagramRequest[]; notes: ReviewNote[]; meta: Record<string, { updatedAt: string; updatedBy: string }> };

async function readState(): Promise<State> {
  try {
    return JSON.parse(await fs.readFile(STATE, 'utf8')) as State;
  } catch {
    return { requests: [], notes: [], meta: {} };
  }
}
async function writeState(s: State) {
  await fs.mkdir(join(process.cwd(), '.local'), { recursive: true });
  await fs.writeFile(STATE, JSON.stringify(s, null, 2));
}
async function readDrill(id: string): Promise<Drill | null> {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  try {
    return drillSchema.parse(JSON.parse(await fs.readFile(join(CONTENT, `${id}.json`), 'utf8')));
  } catch {
    return null;
  }
}
async function writeDrill(d: Drill) {
  await fs.writeFile(join(CONTENT, `${d.id}.json`), JSON.stringify(d, null, 2) + '\n');
}

export class LocalDrillStore implements DrillStore {
  readonly kind = 'local' as const;

  async list(): Promise<DrillSummary[]> {
    const state = await readState();
    const files = (await fs.readdir(CONTENT)).filter((f) => f.endsWith('.json'));
    const drills = (await Promise.all(files.map((f) => readDrill(f.replace(/\.json$/, ''))))).filter((d): d is Drill => !!d);
    return drills.map((d) => ({
      id: d.id,
      funName: d.funName,
      plainName: d.plainName,
      status: d.status,
      groupModel: d.groupModel,
      minutes: d.minutes,
      diagram: d.diagram,
      openRequests: state.requests.filter((r) => r.drillId === d.id && !r.resolvedAt).length,
      updatedAt: state.meta[d.id]?.updatedAt ?? null,
    }));
  }

  async get(id: string): Promise<DrillDetail | null> {
    const drill = await readDrill(id);
    if (!drill) return null;
    const state = await readState();
    return {
      drill,
      requests: state.requests.filter((r) => r.drillId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      notes: state.notes.filter((n) => n.drillId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      updatedAt: state.meta[id]?.updatedAt ?? null,
      updatedBy: state.meta[id]?.updatedBy ?? null,
    };
  }

  private async touch(id: string, actor: string) {
    const state = await readState();
    state.meta[id] = { updatedAt: new Date().toISOString(), updatedBy: actor };
    await writeState(state);
  }

  async save(drill: Drill, actor: string) {
    await writeDrill(drillSchema.parse(drill));
    await this.touch(drill.id, actor);
  }

  async setStatus(id: string, status: Status, actor: string) {
    const d = await readDrill(id);
    if (!d) throw new Error('Drill not found');
    await writeDrill({ ...d, status });
    await this.touch(id, actor);
  }

  async addDiagramRequest(drillId: string, note: string, actor: string) {
    const state = await readState();
    state.requests.push({ id: randomUUID(), drillId, note, createdBy: actor, createdAt: new Date().toISOString(), resolvedAt: null, resolution: null });
    await writeState(state);
  }

  async addNote(drillId: string, body: string, actor: string) {
    const state = await readState();
    state.notes.push({ id: randomUUID(), drillId, body, createdBy: actor, createdAt: new Date().toISOString() });
    await writeState(state);
  }
}
