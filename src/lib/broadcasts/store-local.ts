import 'server-only';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDiscoveryStore } from '../discovery/store';
import type { Age, Broadcast, Draft, Recipient, Segment, SendCounts, Stats } from './schema';
import { EMPTY_DRAFT } from './schema';
import type { BroadcastStore, Queued } from './store';

// Local mode: drafts in .local/broadcasts.json and recipients from the sample people (accounts only), so the
// compose screen works offline. Nothing is ever sent from local mode, and images can't be hosted.
const FILE = join(process.cwd(), '.local', 'broadcasts.json');
type Local = { broadcasts: Broadcast[]; updatesOff: string[] };

async function read(): Promise<Local> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8')) as Local;
  } catch {
    return { broadcasts: [], updatesOff: [] };
  }
}
async function write(d: Local) {
  await fs.mkdir(join(process.cwd(), '.local'), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(d, null, 2));
}

export class LocalBroadcastStore implements BroadcastStore {
  async list() {
    return (await read()).broadcasts.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async get(id: string) {
    return (await read()).broadcasts.find((b) => b.id === id) ?? null;
  }
  async create() {
    const d = await read();
    const now = new Date().toISOString();
    const b: Broadcast = { ...EMPTY_DRAFT, id: randomUUID(), ref: randomUUID().replace(/-/g, '').slice(0, 8), status: 'draft', recipients: 0, createdAt: now, updatedAt: now, sentAt: null };
    d.broadcasts.push(b);
    await write(d);
    return b.id;
  }
  async save(id: string, draft: Draft) {
    const d = await read();
    const b = d.broadcasts.find((x) => x.id === id);
    if (!b || b.status !== 'draft') return false;
    Object.assign(b, draft, { ageGroup: draft.segment === 'age' ? draft.ageGroup : null, updatedAt: new Date().toISOString() });
    await write(d);
    return true;
  }
  async remove(id: string) {
    const d = await read();
    const before = d.broadcasts.length;
    d.broadcasts = d.broadcasts.filter((b) => !(b.id === id && b.status === 'draft'));
    await write(d);
    return d.broadcasts.length < before;
  }
  async recipients(segment: Segment, age: Age | null): Promise<Recipient[]> {
    const off = new Set((await read()).updatesOff);
    const store = await getDiscoveryStore();
    const [people, usage] = await Promise.all([store.people(), store.usage()]);
    return people
      .filter((p) => p.userId && !off.has(p.id))
      .filter((p) => {
        const u = usage.find((x) => x.personId === p.id);
        if (segment === 'head') return u?.teams.some((t) => t.role === 'head_coach') ?? false;
        if (segment === 'age') return u?.teams.some((t) => t.ageGroup === age) ?? false;
        if (segment === 'stalled') return !u || u.practicesRun === 0 || !u.lastActive || Date.now() - new Date(u.lastActive).getTime() > 14 * 86_400_000;
        return true;
      })
      .map((p) => ({ personId: p.id, email: p.email, firstName: p.firstName, teamName: usage.find((x) => x.personId === p.id)?.teams[0]?.name ?? null, unsubscribeToken: `local-${p.id}` }));
  }
  async start(): Promise<number> {
    throw new Error('local-no-email');
  }
  async queued(): Promise<Queued[]> {
    return [];
  }
  async mark() {}
  async finish() {}
  async counts(): Promise<SendCounts> {
    return { queued: 0, sent: 0, failed: 0, skipped: 0 };
  }
  async uploadImage(): Promise<string> {
    throw new Error('no-images-locally');
  }
  async stats(): Promise<Stats | null> {
    return { sent: 0, clicked: 0, links: [], groups: {} };
  }
  async recordClick(): Promise<'ignored'> {
    return 'ignored';
  }
  async updatesStatus(token: string) {
    return token.startsWith('local-') ? (await read()).updatesOff.includes(token.slice(6)) : null;
  }
  async updatesOff(token: string) {
    if (!token.startsWith('local-')) return false;
    const d = await read();
    if (!d.updatesOff.includes(token.slice(6))) d.updatesOff.push(token.slice(6));
    await write(d);
    return true;
  }
}
