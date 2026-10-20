import 'server-only';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { PageEvent, WaitlistEntry, WaitlistInput, WaitlistStatus } from './schema';
import type { NewEvent, SiteStore } from './store';

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
      d.waitlist.unshift({ id: randomUUID(), email: i.email, kind: i.kind, ageGroup: i.ageGroup, orgName: i.orgName, teamCount: i.teamCount, source: i.source, status: 'new', createdAt: new Date().toISOString() });
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
}
