import { describe, expect, it } from 'vitest';
import { sampleData } from './sample';
import { describe as describeResponse, matches, surveyCsv, surveySummary } from './summary';
import { surveyAnswers, toRow } from './schema';

const d = sampleData(new Date('2026-11-05T12:00:00Z'));

describe('survey summary', () => {
  const s = surveySummary(d.responses, d.people, d.notes);
  it('counts the headline numbers', () => {
    expect(s.answers).toBe(4);
    expect(s.signups).toBe(6);
    expect(s.wantCall).toBe(2);
    expect(s.notBooked).toBe(1);
    expect(s.cardsToSend).toBe(3);
  });
  it('counts every filter chip', () => {
    expect(s.filterCounts).toMatchObject({ all: 4, call: 2, card: 3, U7: 2, U9: 3, waitlist: 3, using: 1, older: 0 });
  });
  it('counts themes across answers and notes, most first', () => {
    expect(s.themes[0]).toEqual({ label: 'Kids standing around between drills', n: 3 });
  });
  it('filters by theme too', () => {
    expect(d.responses.filter((r) => matches(r, 'all', 'Who pays'))).toHaveLength(0);
    expect(d.responses.filter((r) => matches(r, 'U9', 'Plans need more coaches than they have'))).toHaveLength(1);
  });
  it('describes an answer in one line', () => expect(describeResponse(d.responses[0])).toBe('Head coach · U7 · Own notes, the night before'));
});

describe('survey answers', () => {
  it('keeps coaches’ swapped questions in extra and drops the call details when they said no', () => {
    const a = surveyAnswers.parse({ role: 'head', ageGroups: ['U7'], changedPlan: 'a_little', plannedHow: 'own_notes', missing: 'A watch view', wantsHelp: 'x', wantsCall: false, phone: '250-555-0148', callTimes: ['weekday_lunch'] });
    const row = toRow(a, 'coach');
    expect(row.extra).toEqual({ changed_plan: 'a_little', missing: 'A watch view' });
    expect(row.planned_how).toBeNull();
    expect(row.wants_help).toBeNull();
    expect(row.phone).toBeNull();
    expect(row.call_times).toEqual([]);
  });
  it('rejects a phone number that isn’t one', () => {
    expect(surveyAnswers.safeParse({ wantsCall: true, phone: 'call me' }).success).toBe(false);
    expect(surveyAnswers.safeParse({ wantsCall: true, phone: '+1 (250) 555-0148' }).success).toBe(true);
  });
});

describe('survey CSV', () => {
  it('quotes every cell and defuses formulas', () => {
    const csv = surveyCsv([{ ...d.responses[0], hardestPart: '=HYPERLINK("x")' }], d.people, d.usage);
    expect(csv.split('\r\n')[0]).toContain('"hardest_part"');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
