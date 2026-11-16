import { describe, expect, it } from 'vitest';
import { progressReminderEmail, progressReportEmail, progressScoringEmail } from './progress-emails';
import { reminderInput, reportInput, scoringInput, type Due, type ScoreRow } from '../progress/emails';

const l = { site: 'https://firstpass.coach' };
const due = (kind: Due['kind'], user = 's'): Due => ({ kind, round_id: 'nov', team_id: 't', month: '2026-11-01', user_id: user, email: 'x@example.com', first_name: user === 's' ? 'Sam' : 'Brett', team_name: 'U7 Blue', skaters: 12 });
const row = (round: string, user: string, name: string, finished: boolean, answers: ScoreRow['answers'] = null): ScoreRow => ({ round_id: round, month: round === 'nov' ? '2026-11-01' : '2026-10-01', skaters: 12, user_id: user, first_name: name, scores: true, emails: true, finished, answers: finished ? answers : null });

const rows: ScoreRow[] = [
  row('nov', 'b', 'Brett', true, { Skating: [1, 4, 6, 1, 0], Shooting: [5, 6, 1, 0, 0] }),
  row('nov', 'k', 'Kara', true, { Skating: [0, 4, 5, 3, 0], Shooting: [1, 4, 5, 2, 0] }),
  row('nov', 's', 'Sam', false, { Skating: [9, 9, 9, 9, 9] }),
  row('oct', 'b', 'Brett', true, { Skating: [2, 5, 5, 0, 0], Shooting: [5, 6, 1, 0, 0] }),
  row('oct', 's', 'Sam', false),
];

describe('progress scoring email', () => {
  it('starts from last month only for a coach who scored it, and names the other scorers', () => {
    const sam = progressScoringEmail(scoringInput(due('scoring'), rows, l));
    expect(sam.subject).toBe('Time for November’s progress scoring');
    expect(sam.text).not.toContain('October answers');
    // Brett and Kara have finished, so they won't get it: nobody else is named.
    expect(sam.text).not.toContain('get this too');
    const brett = progressScoringEmail(scoringInput(due('scoring', 'b'), rows, l));
    expect(brett.text).toContain('starts from your October answers');
    expect(brett.html).toContain('https://firstpass.coach/progress/score');
    // Before anyone finishes: names only coaches who'll get it (emails on).
    const open = rows.map((r) => ({ ...r, finished: false, emails: r.user_id !== 'k' }));
    expect(progressScoringEmail(scoringInput(due('scoring', 'b'), open, l)).text).toContain('Sam gets this too');
  });
});

describe('progress reminder email', () => {
  it('names only the coaches who have finished, never their answers', () => {
    const e = progressReminderEmail(reminderInput(due('reminder'), rows, l));
    expect(e.subject).toBe('November’s progress report is out. Add your scores to see it');
    expect(e.text).toContain('Brett and Kara have scored, Sam.');
    expect(e.html).not.toContain('2.6');
  });
  it('reads as a plain reminder when nobody has scored', () => {
    const e = progressReminderEmail(reminderInput(due('reminder'), rows.map((r) => ({ ...r, finished: false })), l));
    expect(e.subject).toBe('November’s progress scoring is still open');
  });
});

describe('progress report email', () => {
  const input = reportInput(due('report', 'b'), rows, l)!;
  const e = progressReportEmail(input);
  it('names only coaches who finished', () => {
    expect(input.coaches).toEqual(['Brett', 'Kara']);
    expect(e.text).not.toContain('Sam');
    expect(e.html).not.toContain('Sam');
  });
  it('leads with the skill that moved most, and shows the gap', () => {
    expect(e.subject).toBe('November progress report: skating up 0.5');
    expect(e.text).toContain('Skating: 2.8 (+0.5)');
    expect(input.gap?.attribute).toBe('Shooting');
    expect(e.text).toContain('Brett 1.7 · Kara 2.7');
  });
  it('says first report when there is nothing to compare', () => {
    const first = reportInput(due('report', 'b'), rows.filter((r) => r.round_id === 'nov'), l)!;
    expect(first.first).toBe(true);
    expect(progressReportEmail(first).subject).toBe('Your first progress report: November');
  });
});

describe('every progress email', () => {
  const all = [progressScoringEmail(scoringInput(due('scoring'), rows, l)), progressReminderEmail(reminderInput(due('reminder'), rows, l)), progressReportEmail(reportInput(due('report', 'b'), rows, l)!)];
  it('has a way to turn them off, in the html and the text', () => {
    for (const e of all) {
      expect(e.html).toContain('Turn progress emails off');
      expect(e.text).toContain('https://firstpass.coach/team#emails');
    }
  });
  it('escapes a team name', () => {
    const e = progressScoringEmail({ ...scoringInput(due('scoring'), rows, l), teamName: '<b>U7</b>' });
    expect(e.html).not.toContain('<b>U7</b>');
  });
});
