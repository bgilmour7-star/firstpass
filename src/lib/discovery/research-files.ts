import { CALL_TIMES, CHANGED_PLAN, NOTE_KIND_LABEL, PLANNED_HOW, PLANNED_WHEN, ROLES, labelOf, type Note, type Person, type SurveyResponse, type Usage } from './schema';

// The repo copy of discovery (decision 0027, spec "Research sync"): one Markdown file per person,
// research/coaches/<code>.md, and research/themes.md. Pseudonymous: the code, first name, team and
// age group only. Never an email, phone number or user id, even one typed into an answer or a note:
// redact() scrubs free text, and a test checks the output. Pure, so scripts/research.ts only does I/O.

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// 7+ digits with optional separators, brackets or a leading +: phone numbers, not years or counts.
const PHONE_RE = /(?:\+?\d[\s().-]*){7,}\d?/g;

export function redact(text: string): string {
  return text.replace(EMAIL_RE, '[email removed]').replace(PHONE_RE, (m) => (m.replace(/\D/g, '').length >= 7 ? '[phone removed]' : m));
}

/** First name only, never the email (which is all some people have). */
export function safeName(p: Pick<Person, 'firstName' | 'code'>): string {
  const n = p.firstName?.trim();
  return n && !n.includes('@') ? redact(n).slice(0, 40) : p.code;
}

// "Oct 30, 2026": readable, and never mistaken for a phone number the way 2026-10-30 can be.
const day = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Vancouver' });
const quote = (s: string) => `> ${redact(s).replace(/\r?\n/g, '\n> ')}`;

export type PersonFile = { path: string; body: string };

export function personFile(p: Person, responses: SurveyResponse[], notes: Note[], usage: Usage | undefined): PersonFile {
  const name = safeName(p);
  const ages = [...new Set([...(usage?.teams.map((t) => t.ageGroup) ?? []), ...responses.flatMap((r) => r.ageGroups)])];
  const themes = [...new Set([...responses.flatMap((r) => r.themes), ...notes.flatMap((n) => n.themes)])];
  const lines: string[] = [
    `# ${p.code} · ${name}`,
    '',
    `Synced by \`npm run research -- sync\`. Pseudonymous: no email, phone or account id. Edit notes in Admin → Coaches, not here.`,
    '',
    '## Situation',
    '',
    `- Where: ${p.audience === 'coach' ? 'Using Firstpass' : 'Waitlist'} since ${day(p.createdAt)}`,
  ];
  if (usage?.teams.length) {
    for (const t of usage.teams) lines.push(`- Team: ${redact(t.name)} (${t.ageGroup}, ${t.role === 'head_coach' ? 'head coach' : 'coach'}, ${t.skaters} skaters, ${t.coaches} coaches, ${t.ice} ice)`);
  }
  if (ages.length) lines.push(`- Age groups: ${ages.join(', ')}`);
  const latest = responses[0];
  if (latest?.role) lines.push(`- Role: ${labelOf(ROLES, latest.role, false)}`);
  if (latest?.extra.multi_team) lines.push('- Coaches more than one team');

  lines.push('', '## Usage', '');
  if (usage) {
    lines.push(`- Practices run: ${usage.practicesRun}`, `- Check-ins: ${usage.checkins}`, `- Drills swapped: ${usage.swaps}`, `- Last active: ${usage.lastActive ? day(usage.lastActive) : 'never'}`);
  } else lines.push('Not using Firstpass yet.');

  lines.push('', '## Survey', '');
  if (!responses.length) lines.push('Not answered.');
  for (const r of responses) {
    lines.push(`### ${day(r.createdAt)} · ${r.audience === 'older' ? 'U11+ screen' : r.audience === 'coach' ? 'Coach survey' : 'Waitlist survey'}`, '');
    const how = labelOf(PLANNED_HOW, r.plannedHow, false);
    const changed = labelOf(CHANGED_PLAN, r.extra.changed_plan, false);
    const when = labelOf(PLANNED_WHEN, r.plannedWhen, false);
    if (how) lines.push(`- Planned the last practice: ${how}${r.extra.app ? ` (${redact(r.extra.app)})` : ''}`);
    if (changed) lines.push(`- Firstpass's plan: ${changed}`);
    if (when) lines.push(`- When: ${when}`);
    lines.push(`- Wants a call: ${r.wantsCall ? `yes${r.callTimes.length ? ` (${r.callTimes.map((t) => labelOf(CALL_TIMES, t)).join(', ')})` : ''}, ${r.callStatus === 'to_book' ? 'not booked yet' : r.callStatus}` : 'not right now'}`);
    if (r.hardestPart) lines.push('', 'Hardest part of the last practice:', '', quote(r.hardestPart));
    if (r.wantsHelp) lines.push('', 'What would help:', '', quote(r.wantsHelp));
    if (r.extra.missing) lines.push('', "What's missing or got in the way:", '', quote(r.extra.missing));
    if (r.themes.length) lines.push('', `Themes: ${r.themes.join(' · ')}`);
    lines.push('');
  }

  lines.push('## Notes', '');
  if (!notes.length) lines.push('None yet.');
  for (const n of [...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    lines.push(`### ${day(n.createdAt)} · ${NOTE_KIND_LABEL[n.kind]}`, '', redact(n.body), ...(n.themes.length ? ['', `Themes: ${n.themes.join(' · ')}`] : []), '');
  }

  lines.push('## Themes', '', themes.length ? themes.map((t) => `- ${t}`).join('\n') : 'None yet.', '');
  return { path: `research/coaches/${p.code}.md`, body: lines.join('\n').replace(/\n{3,}/g, '\n\n') };
}

const short = (s: string) => {
  const t = redact(s).replace(/\s+/g, ' ').trim();
  return t.length > 160 ? `${t.slice(0, 157).trimEnd()}…` : t;
};

export function themesFile(people: Person[], responses: SurveyResponse[], notes: Note[], known: string[]): PersonFile {
  const code = new Map(people.map((p) => [p.id, p.code]));
  type Q = { code: string; text: string };
  const m = new Map<string, { n: number; quotes: Q[] }>();
  const add = (t: string, q: Q | null) => {
    const e = m.get(t) ?? { n: 0, quotes: [] };
    e.n++;
    if (q && e.quotes.length < 3) e.quotes.push(q);
    m.set(t, e);
  };
  for (const r of responses) for (const t of r.themes) add(t, r.hardestPart ? { code: code.get(r.personId) ?? '?', text: short(r.hardestPart) } : null);
  for (const n of notes) for (const t of n.themes) add(t, { code: code.get(n.personId) ?? '?', text: short(n.body) });
  const rows = [...m.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
  const unused = known.filter((k) => !m.has(k)).sort();
  const lines = [
    '# Themes',
    '',
    `Synced by \`npm run research -- sync\`. ${responses.length} survey answers and ${notes.length} notes from ${people.length} people. Counts are answers and notes tagged with each theme.`,
    '',
  ];
  if (!rows.length) lines.push('No themes tagged yet.', '');
  for (const [t, e] of rows) {
    lines.push(`## ${t} (${e.n})`, '');
    for (const q of e.quotes) lines.push(`- ${q.code}: “${q.text}”`);
    lines.push('');
  }
  if (unused.length) lines.push('## Not used yet', '', ...unused.map((t) => `- ${t}`), '');
  return { path: 'research/themes.md', body: lines.join('\n') };
}

/** Every file the sync writes, given everything in the database. */
export function researchFiles(d: { people: Person[]; responses: SurveyResponse[]; notes: Note[]; usage: Usage[]; themes: string[] }): PersonFile[] {
  const use = new Map(d.usage.map((u) => [u.personId, u]));
  return [
    ...d.people.map((p) =>
      personFile(
        p,
        d.responses.filter((r) => r.personId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        d.notes.filter((n) => n.personId === p.id),
        use.get(p.id),
      ),
    ),
    themesFile(d.people, d.responses, d.notes, d.themes),
  ];
}
