import 'server-only';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { Device, PageEvent, WaitlistEntry, WaitlistInput, WaitlistStatus } from './schema';
import type { UsageRows } from './usage';
import type { MetricName, PageGroup, Vital } from './vitals';
import type { NewEvent, SiteStore } from './store';

// Local mode: the waitlist and visits live in .local/site.json.
const FILE = join(process.cwd(), '.local', 'site.json');
type Open = { userId: string; day: string; installed: boolean; at: string };
type Data = { waitlist: WaitlistEntry[]; events: PageEvent[]; vitals?: Vital[]; opens?: Open[] };

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

  async recordVitals(page: PageGroup, device: Device, metrics: { name: MetricName; value: number }[]) {
    const d = await read();
    const at = new Date().toISOString();
    d.vitals = [...(d.vitals ?? []), ...metrics.map((m) => ({ occurredAt: at, metric: m.name, value: m.value, page, device }))];
    await write(d);
  }

  async recordAppOpen(userId: string, installed: boolean) {
    const d = await read();
    const day = new Date().toISOString().slice(0, 10);
    d.opens ??= [];
    if (!d.opens.some((o) => o.userId === userId && o.day === day && o.installed === installed)) d.opens.push({ userId, day, installed, at: new Date().toISOString() });
    await write(d);
  }

  async vitals(sinceIso: string) {
    return ((await read()).vitals ?? []).filter((v) => v.occurredAt >= sinceIso);
  }

  async usage(sinceIso: string): Promise<UsageRows> {
    // Local mode keeps fewer timestamps than the database: a plan counts as made on its date.
    const app = await readApp();
    const opens = (await read()).opens ?? [];
    const since = sinceIso.slice(0, 10);
    const teamOf = (userId: string) => app.members?.find((m) => m.userId === userId)?.teamId ?? null;
    const checkins = app.checkins ?? [];
    return {
      teams: (app.teams ?? []).map((t) => ({ id: t.id, createdAt: '2026-01-01T00:00:00Z' })),
      practices: (app.practices ?? [])
        .filter((p) => p.date >= since)
        .map((p) => ({ id: p.id, teamId: p.teamId, date: p.date, createdAt: `${p.date}T12:00:00Z`, blocks: p.blocks, checkedIn: checkins.some((c) => c.practiceId === p.id) })),
      activity: [
        ...opens.filter((o) => o.at >= sinceIso).map((o) => ({ userId: o.userId, teamId: teamOf(o.userId), at: o.at, kind: o.installed ? ('open_installed' as const) : ('open' as const) })),
        ...(app.edits ?? []).filter((e) => e.at >= sinceIso).map((e) => ({ userId: e.userId, teamId: e.teamId, at: e.at, kind: 'edit' as const })),
        ...checkins.filter((c) => c.savedAt >= sinceIso).map((c) => ({ userId: c.userId, teamId: c.teamId, at: c.savedAt, kind: 'checkin' as const })),
      ],
      marks: checkins
        .filter((c) => c.savedAt >= sinceIso)
        .flatMap((c) => (c.marks ?? []).filter((m) => m.rating === 'hit' || m.rating === 'flop').map((m) => ({ drillId: m.drillId, rating: m.rating as 'hit' | 'flop', at: c.savedAt }))),
      actions: (app.kept ?? []).filter((k) => k.at >= sinceIso).map((k) => ({ kind: 'kept' as const, at: k.at })),
    };
  }
}

// The coach app's local file (src/lib/app/store-local.ts), read for Analytics only.
type AppFile = {
  teams?: { id: string }[];
  members?: { teamId: string; userId: string }[];
  practices?: { id: string; teamId: string; date: string; blocks: UsageRows['practices'][number]['blocks'] }[];
  edits?: { userId: string; teamId: string; at: string }[];
  checkins?: { practiceId: string; teamId: string; userId: string; savedAt: string; marks?: { drillId: string; rating: string }[] }[];
  kept?: { at: string }[];
};
async function readApp(): Promise<AppFile> {
  try {
    return JSON.parse(await fs.readFile(join(process.cwd(), '.local', 'app.json'), 'utf8')) as AppFile;
  } catch {
    return {};
  }
}
