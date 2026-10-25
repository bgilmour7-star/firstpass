import 'server-only';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Audience, CallStatus, GiftCard, Note, NoteKind, Person, SendStats, SurveyResponse, Usage } from './schema';
import type { DiscoveryStore, SubmitResult, ThemeTarget } from './store';
import { sampleData, type LocalDiscovery } from './sample';

// Local mode: discovery lives in .local/discovery.json, seeded with sample people the first time so
// the survey (/s/sample-waitlist, /s/sample-coach) and the admin pages can be built offline.
const FILE = join(process.cwd(), '.local', 'discovery.json');

async function read(): Promise<LocalDiscovery> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8')) as LocalDiscovery;
  } catch {
    const d = sampleData(new Date());
    await write(d);
    return d;
  }
}
async function write(d: LocalDiscovery) {
  await fs.mkdir(join(process.cwd(), '.local'), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(d, null, 2));
}

/** The waitlist form in local mode: the same upsert the database trigger does. */
export async function linkLocalPerson(email: string, waitlistId: string) {
  const d = await read();
  const clean = email.trim().toLowerCase();
  let p = d.people.find((x) => x.email === clean);
  if (!p) {
    p = { id: randomUUID(), code: `c-${String(101 + d.people.length).padStart(4, '0')}`, email: clean, firstName: null, audience: 'waitlist', userId: null, waitlistId, unsubscribedAt: null, createdAt: new Date().toISOString() };
    d.people.unshift(p);
    d.invites.push({ token: randomUUID().replace(/-/g, ''), personId: p.id, audience: 'waitlist', usedAt: null });
    d.unsubscribeTokens[p.id] = randomUUID().replace(/-/g, '');
  } else p.waitlistId ??= waitlistId;
  await write(d);
}

export class LocalDiscoveryStore implements DiscoveryStore {
  async invite(token: string) {
    const d = await read();
    const i = d.invites.find((x) => x.token === token);
    const p = i && d.people.find((x) => x.id === i.personId);
    if (!i || !p) return null;
    const team = d.usage.find((u) => u.personId === p.id)?.teams[0]?.name ?? null;
    return { audience: i.audience, firstName: p.firstName, email: p.email, used: Boolean(i.usedAt), teamName: team };
  }

  async submit(token: string, row: Record<string, unknown>): Promise<SubmitResult> {
    const d = await read();
    const i = d.invites.find((x) => x.token === token);
    if (!i) return 'unknown';
    if (i.usedAt) return 'used';
    const r = row as { role: string | null; age_groups: string[]; planned_how: string | null; planned_when: string | null; hardest_part: string | null; wants_help: string | null; extra: SurveyResponse['extra']; wants_call: boolean; call_times: string[]; phone: string | null };
    d.responses.unshift({
      id: randomUUID(), personId: i.personId, audience: i.audience, role: r.role, ageGroups: r.age_groups, plannedHow: r.planned_how, plannedWhen: r.planned_when,
      hardestPart: r.hardest_part, wantsHelp: r.wants_help, extra: r.extra, wantsCall: r.wants_call, callTimes: r.call_times, phone: r.phone,
      callStatus: r.wants_call ? 'to_book' : 'none', giftCard: 'owed', themes: [], createdAt: new Date().toISOString(),
    });
    // The sample links stay reusable so the survey can be walked through again.
    if (!token.startsWith('sample-')) i.usedAt = new Date().toISOString();
    await write(d);
    return 'ok';
  }

  async unsubscribeStatus(token: string) {
    const d = await read();
    const id = Object.entries(d.unsubscribeTokens).find(([, t]) => t === token)?.[0];
    const p = id && d.people.find((x) => x.id === id);
    return p ? { audience: p.audience as Audience, unsubscribed: Boolean(p.unsubscribedAt) } : null;
  }

  async unsubscribe(token: string) {
    const d = await read();
    const id = Object.entries(d.unsubscribeTokens).find(([, t]) => t === token)?.[0];
    const p = id && d.people.find((x) => x.id === id);
    if (!p) return false;
    p.unsubscribedAt ??= new Date().toISOString();
    await write(d);
    return true;
  }

  async people(): Promise<Person[]> {
    return (await read()).people;
  }
  async responses(): Promise<SurveyResponse[]> {
    return [...(await read()).responses].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async notes(personId?: string): Promise<Note[]> {
    return (await read()).notes.filter((n) => !personId || n.personId === personId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async addNote(personId: string, kind: NoteKind, body: string) {
    const d = await read();
    d.notes.unshift({ id: randomUUID(), personId, kind, body, themes: [], createdAt: new Date().toISOString() });
    await write(d);
  }
  async setCallStatus(responseId: string, status: CallStatus) {
    const d = await read();
    const r = d.responses.find((x) => x.id === responseId);
    if (r) r.callStatus = status;
    await write(d);
  }
  async setGiftCard(responseId: string, card: GiftCard) {
    const d = await read();
    const r = d.responses.find((x) => x.id === responseId);
    if (r) r.giftCard = card;
    await write(d);
  }
  async setThemes(target: ThemeTarget, themes: string[]) {
    const d = await read();
    const list: { id: string; themes: string[] }[] = target.kind === 'response' ? d.responses : d.notes;
    const r = list.find((x) => x.id === target.id);
    if (r) r.themes = themes;
    for (const t of themes) if (!d.themes.includes(t)) d.themes.push(t);
    await write(d);
  }
  async themes() {
    return [...(await read()).themes].sort();
  }
  async usage(): Promise<Usage[]> {
    return (await read()).usage;
  }
  async sendStats(): Promise<SendStats> {
    return (await read()).sends;
  }
  async surveyToken(personId: string) {
    const d = await read();
    const p = d.people.find((x) => x.id === personId);
    return (d.invites.find((i) => i.personId === personId && i.audience === p?.audience) ?? d.invites.find((i) => i.personId === personId))?.token ?? null;
  }
}
