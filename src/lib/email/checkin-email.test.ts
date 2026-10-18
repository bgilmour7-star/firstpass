import { describe, expect, it } from 'vitest';
import { checkinEmail, clock, listNames, nextPlanPhrase } from './checkin-email';

const base = {
  teamName: 'Nanaimo U7 Blue',
  practiceDate: '2026-10-20', // a Tuesday
  startTime: '17:45:00',
  nextDate: '2026-10-22',
  checkedIn: [],
  checkinUrl: 'https://firstpass.coach/plans/p1/check-in',
  settingsUrl: 'https://firstpass.coach/team#emails',
};

describe('check-in email', () => {
  it('names the practice day and the next plan', () => {
    const e = checkinEmail(base);
    expect(e.subject).toBe('How did Tuesday’s practice go?');
    expect(e.text).toContain('About 20 seconds. Your answers shape Thursday’s plan.');
    expect(e.text).toContain('Check in: https://firstpass.coach/plans/p1/check-in');
    expect(e.html).toContain('href="https://firstpass.coach/plans/p1/check-in"');
    expect(e.text).toContain('Nanaimo U7 Blue · Tue, Oct 20, 5:45 pm');
  });

  it('falls back when the next practice is far off or unknown', () => {
    expect(nextPlanPhrase('2026-10-20', null)).toBe('your next plan');
    expect(nextPlanPhrase('2026-10-20', '2026-11-04')).toBe('the plan for Wed, Nov 4');
  });

  it('says who already checked in', () => {
    expect(checkinEmail({ ...base, checkedIn: ['Kara'] }).text).toContain('Kara has checked in already.');
    expect(checkinEmail({ ...base, checkedIn: ['Kara', 'Sam', 'Lee'] }).text).toContain('Kara, Sam and Lee have checked in already.');
    expect(checkinEmail(base).text).not.toContain('checked in already');
    expect(listNames([])).toBe('');
  });

  it('escapes the team name in the html', () => {
    expect(checkinEmail({ ...base, teamName: 'U7 <Blue> & Co' }).html).toContain('U7 &lt;Blue&gt; &amp; Co');
  });

  it('formats clock times', () => {
    expect(clock('07:05')).toBe('7:05 am');
    expect(clock('12:00')).toBe('12:00 pm');
    expect(clock('00:30')).toBe('12:30 am');
  });

  it('always offers a way to turn the emails off', () => {
    const e = checkinEmail(base);
    expect(e.text).toContain('Turn these emails off on your Team page: https://firstpass.coach/team#emails');
    expect(e.html).toContain('href="https://firstpass.coach/team#emails"');
  });
});
