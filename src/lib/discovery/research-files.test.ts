import { describe, expect, it } from 'vitest';
import { redact, researchFiles, safeName } from './research-files';
import { sampleData } from './sample';
import type { Note, Person, SurveyResponse } from './schema';

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// Any run of 7 or more digits once separators are ignored: a phone number in any format.
const hasPhone = (s: string) => (s.match(/[\d\s().+-]{7,}/g) ?? []).some((m) => m.replace(/\D/g, '').length >= 7);

describe('research sync writer', () => {
  const d = sampleData(new Date('2026-11-05T12:00:00Z'));
  // Make it hard: contact details typed into answers, notes, names and teams.
  const leakyPerson: Person = { ...d.people[0], id: 'leak', code: 'c-0999', email: 'leaky@example.com', firstName: 'leaky@example.com' };
  const leaky: SurveyResponse = { ...d.responses[0], id: 'leak-r', personId: 'leak', phone: '250-555-0148', hardestPart: 'Call me at (250) 555-0148 or +1 250 555 0199, or email me at coach.kara+u7@shaw.ca.', wantsHelp: 'text 2505550148', extra: { app: 'mail me: a@b.co' } };
  const leakyNote: Note = { id: 'leak-n', personId: 'leak', kind: 'call', body: 'Her number is 250.555.0148 and her email is jo@example.org. Practice is at 5:45 on Oct 28, 2026, 14 skaters.', themes: ['Who pays'], createdAt: '2026-11-01T00:00:00Z' };
  const data = { ...d, people: [...d.people, leakyPerson], responses: [...d.responses, leaky], notes: [...d.notes, leakyNote], usage: [...d.usage, { personId: 'leak', teams: [{ name: 'U7 call 250-555-0100', ageGroup: 'U7', ice: 'half', role: 'coach' as const, joinedAt: '2026-10-01T00:00:00Z', skaters: 12, coaches: 2 }], practicesRun: 1, checkins: 0, swaps: 0, lastActive: null }] };
  const files = researchFiles(data);

  it('never writes an email address or phone number', () => {
    for (const f of files) {
      expect(f.body, f.path).not.toMatch(EMAIL);
      expect(hasPhone(f.body), `${f.path} has a phone number`).toBe(false);
    }
  });

  it('never writes an account id or the raw email of anyone in the data', () => {
    const all = files.map((f) => f.body).join('\n');
    for (const p of data.people) {
      expect(all).not.toContain(p.email);
      if (p.userId) expect(all).not.toContain(p.userId);
    }
  });

  it('writes one file per person by code, plus themes.md', () => {
    expect(files.map((f) => f.path)).toEqual([...data.people.map((p) => `research/coaches/${p.code}.md`), 'research/themes.md']);
  });

  it('keeps what makes the notes useful: names, teams, ages, words, dates and counts', () => {
    const jordan = files.find((f) => f.path === `research/coaches/${d.people[0].code}.md`)!.body;
    expect(jordan).toContain('# c-0101 · Jordan');
    expect(jordan).toContain('Keeping 14 kids busy');
    expect(jordan).toContain('Themes: Kids standing around between drills');
    const kara = files.find((f) => f.path === 'research/coaches/c-0104.md')!.body;
    expect(kara).toContain('Team: Nanaimo U7 Avalanche (U7, head coach, 12 skaters, 3 coaches, half ice)');
    expect(kara).toContain('Practices run: 6');
    const leak = files.find((f) => f.path === 'research/coaches/c-0999.md')!.body;
    expect(leak).toContain('# c-0999 · c-0999');
    expect(leak).toContain('5:45 on Oct 28, 2026, 14 skaters');
  });

  it('counts themes with short quotes by code', () => {
    const themes = files.at(-1)!.body;
    expect(themes).toMatch(/## Kids standing around between drills \(\d+\)/);
    expect(themes).toContain('- c-0101: “Keeping 14 kids busy');
  });
});

describe('redact', () => {
  it('removes emails and phone numbers but keeps times, years and counts', () => {
    expect(redact('me@x.ca or 250-555-0148')).toBe('[email removed] or [phone removed]');
    expect(redact('5:45 pm, Oct 2026, 14 kids, 3 stations')).toBe('5:45 pm, Oct 2026, 14 kids, 3 stations');
  });
  it('uses the code when the only name is an email', () => expect(safeName({ firstName: 'a@b.ca', code: 'c-0101' })).toBe('c-0101'));
});
