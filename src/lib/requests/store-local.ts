import 'server-only';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { OPEN_LIMIT, isOpen, parseProposed, type DrillRequest, type RequestInput } from './schema';
import type { RequestStore } from './store';

// Local mode: requests live in .local/requests.json. To play Claude's part by hand, set a
// request's "state" to "drafted" (and "proposed" to a full drill, for a change) in that file.
const FILE = join(process.cwd(), '.local', 'requests.json');

async function read(): Promise<DrillRequest[]> {
  try {
    return (JSON.parse(await fs.readFile(FILE, 'utf8')) as DrillRequest[]).map((r) => ({ ...r, proposed: parseProposed(r.proposed) }));
  } catch {
    return [];
  }
}
async function write(all: DrillRequest[]) {
  await fs.mkdir(join(process.cwd(), '.local'), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

export class LocalRequestStore implements RequestStore {
  async create(input: RequestInput, at: { teamId: string; userId: string; name: string; email: string }) {
    const all = await read();
    if (all.filter((r) => r.teamId === at.teamId && isOpen(r)).length >= OPEN_LIMIT) throw new Error('request-limit');
    const r: DrillRequest = {
      id: randomUUID(),
      kind: input.kind,
      teamId: at.teamId,
      teamName: null,
      requestedBy: at.userId,
      requesterName: at.name,
      requesterEmail: at.email,
      drillId: input.kind === 'change' ? input.drillId : null,
      answers: input.kind === 'new' ? input.answers : { focus: [] },
      description: input.description,
      link: input.kind === 'new' ? input.link : null,
      state: 'sent',
      proposed: null,
      claudeNote: null,
      reason: null,
      createdAt: new Date().toISOString(),
      draftedAt: null,
      decidedAt: null,
    };
    await write([r, ...all]);
    return r;
  }
  async forTeam(teamId: string) {
    return (await read()).filter((r) => r.teamId === teamId);
  }
  async all() {
    return read();
  }
  async get(id: string) {
    return (await read()).find((r) => r.id === id) ?? null;
  }
  async decide(id: string, state: 'accepted' | 'declined', reason: string | null) {
    const all = await read();
    const before = all.find((r) => r.id === id);
    if (!before || !isOpen(before)) return null;
    await write(all.map((r) => (r.id === id ? { ...r, state, reason, decidedAt: new Date().toISOString() } : r)));
    return before;
  }
  async markCoachEmailed() {}
}
