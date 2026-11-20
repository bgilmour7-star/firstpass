import 'server-only';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { Device, PageEvent, WaitlistEntry, WaitlistInput, WaitlistStatus } from './schema';
import type { UsageRows } from './usage';
import type { ProgressUsageRows } from '../progress/usage';
import type { MetricName, PageGroup, Vital } from './vitals';
import type { Growth, NewEvent, SiteStore } from './store';

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
    d.events.push({ occurredAt: new Date().toISOString(), name: e.name, visitor, source: e.source, device: e.device, region: e.region, path: e.path });
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

  async progressUsage(month: string): Promise<ProgressUsageRows> {
    return localProgressUsage(month);
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

  // Local mode reads the app's own file. Memberships made before this change have no time, so
  // they count from the day the file was first used.
  async growth(): Promise<Growth> {
    let app: { members?: { teamId: string; userId: string; role: string; at?: string }[] } = {};
    try {
      app = JSON.parse(await fs.readFile(join(process.cwd(), '.local', 'app.json'), 'utf8'));
    } catch {
      return { teams: [], coaches: [], accounts: [] };
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
    // Local mode has no accounts: a coach's first membership stands in for it.
    return { teams: earliest((m) => m.teamId), coaches: earliest((m) => m.userId), accounts: earliest((m) => m.userId) };
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
/** Local mode's progress file (src/lib/progress/store-local.ts), read as progress_usage would return it. */
async function localProgressUsage(month: string): Promise<ProgressUsageRows> {
  type P = { rounds?: { id: string; teamId: string; month: string; skaters: number }[]; scores?: { roundId: string; teamId: string; userId: string; finishedAt: string | null; seconds: number | null; done: string[]; noChange: string[]; answers: ProgressUsageRows['scores'][number]['answers'] }[]; goals?: (ProgressUsageRows['goals'][number] & { endedAt: string | null })[] };
  let p: P = {};
  try {
    p = JSON.parse(await fs.readFile(join(process.cwd(), '.local', 'progress.json'), 'utf8')) as P;
  } catch {
    /* no progress yet */
  }
  const app = (await readApp()) as unknown as { teams?: { id: string; name: string }[]; members?: { teamId: string; userId: string; role?: string }[]; practices?: { teamId: string; date: string }[] };
  const [y, m] = month.split('-').map(Number);
  const prev = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
  const rounds = (p.rounds ?? []).filter((r) => r.month === month || r.month === prev);
  const ids = new Set(rounds.map((r) => r.id));
  return {
    teams: (app.teams ?? []).map((t) => ({ id: t.id, name: t.name, lastPlanAt: (app.practices ?? []).filter((x) => x.teamId === t.id).map((x) => `${x.date}T12:00:00Z`).sort().at(-1) ?? null })),
    members: (app.members ?? []).map((x) => ({ teamId: x.teamId, userId: x.userId, role: x.role === 'head_coach' ? 'head_coach' : 'coach', scores: true })),
    rounds,
    scores: (p.scores ?? []).filter((x) => ids.has(x.roundId)).map((x) => ({ roundId: x.roundId, teamId: x.teamId, userId: x.userId, finished: Boolean(x.finishedAt), seconds: x.seconds, done: x.done.length, noChange: x.noChange.length, answers: x.finishedAt ? x.answers : null })),
    goals: (p.goals ?? []).filter((g) => !g.endedAt),
    emailed: [],
    views: [],
    taken: [],
    kept: [],
    months: [...new Set((p.rounds ?? []).map((r) => r.month))].sort().reverse(),
  };
}

async function readApp(): Promise<AppFile> {
  try {
    return JSON.parse(await fs.readFile(join(process.cwd(), '.local', 'app.json'), 'utf8')) as AppFile;
  } catch {
    return {};
  }
}
