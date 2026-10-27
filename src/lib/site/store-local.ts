import 'server-only';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { PageEvent, WaitlistEntry, WaitlistInput, WaitlistStatus } from './schema';
import type { Growth, NewEvent, SiteStore } from './store';

// Local mode: the waitlist and visits live in .local/site.json.
const FILE = join(process.cwd(), '.local', 'site.json');
type Data = { waitlist: WaitlistEntry[]; events: PageEvent[] };

async function read(): Promise<Data> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8')) as Data;
  } catch {
    return { waitlist: [], events: [] };
  }
}
async function write(d: Data) {
  await fs.mkdir(join(process.cwd(), '.local'), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(d, null, 2));
}

export class LocalSiteStore implements SiteStore {
  async join(i: WaitlistInput) {
    const d = await read();
    const found = d.waitlist.find((w) => w.email === i.email);
    if (found) {
      Object.assign(found, { kind: i.kind, ageGroup: i.ageGroup ?? found.ageGroup, orgName: i.orgName ?? found.orgName, teamCount: i.teamCount ?? found.teamCount });
    } else {
      const id = randomUUID();
      d.waitlist.unshift({ id, email: i.email, kind: i.kind, ageGroup: i.ageGroup, orgName: i.orgName, teamCount: i.teamCount, source: i.source, status: 'new', createdAt: new Date().toISOString() });
      // What the discovery migration's trigger does in the database (decision 0027).
      const { linkLocalPerson } = await import('../discovery/store-local');
      await linkLocalPerson(i.email, id);
    }
    await write(d);
    return { isNew: !found };
  }

  async canCreateAccount(email: string) {
    return (await read()).waitlist.some((w) => w.email === email.trim().toLowerCase() && w.status === 'onboarded');
  }

  async record(e: NewEvent) {
    const d = await read();
    const day = new Date().toISOString().slice(0, 10);
    const visitor = createHash('sha256').update(`${day}|${e.ip ?? ''}|${e.agent ?? ''}`).digest('hex');
    d.events.push({ occurredAt: new Date().toISOString(), name: e.name, visitor, source: e.source, device: e.device, region: e.region });
    await write(d);
  }

  async waitlist() {
    return (await read()).waitlist.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async events(sinceIso: string) {
    return (await read()).events.filter((e) => e.occurredAt >= sinceIso);
  }

  async setStatus(id: string, status: WaitlistStatus) {
    const d = await read();
    const w = d.waitlist.find((x) => x.id === id);
    if (w) w.status = status;
    await write(d);
  }

  // Local mode reads the app's own file. Memberships made before this change have no time, so
  // they count from the day the file was first used.
  async growth(): Promise<Growth> {
    let app: { members?: { teamId: string; userId: string; role: string; at?: string }[] } = {};
    try {
      app = JSON.parse(await fs.readFile(join(process.cwd(), '.local', 'app.json'), 'utf8'));
    } catch {
      return { teams: [], coaches: [] };
    }
    const members = app.members ?? [];
    const fallback = '2026-10-14T00:00:00Z';
    // Earliest membership per key: a coach counts from their first team, and a team from its first
    // coach (so handing a team over doesn't move its date).
    const earliest = (key: (m: (typeof members)[number]) => string) => {
      const first = new Map<string, string>();
      for (const m of members) {
        const at = m.at ?? fallback;
        const k = key(m);
        if (!first.has(k) || at < first.get(k)!) first.set(k, at);
      }
      return [...first.values()];
    };
    return { teams: earliest((m) => m.teamId), coaches: earliest((m) => m.userId) };
  }
}
