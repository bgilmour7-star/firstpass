import { describe, expect, it } from 'vitest';
import { classify, normaliseCalendarUrl, parseIcs } from './ics';

const feed = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//TeamSnap//EN',
  'X-WR-CALNAME:U7 Blue',
  'X-WR-TIMEZONE:America/Vancouver',
  'BEGIN:VEVENT',
  'UID:practice-1@teamsnap.com',
  'DTSTART;TZID=America/Vancouver:20261015T174500',
  'DTEND;TZID=America/Vancouver:20261015T184500',
  'SUMMARY:Practice',
  'LOCATION:Frank Crane Arena - Rink 2',
  'DESCRIPTION:Arrive 20 min early\\, full gear.',
  'BEGIN:VALARM',
  'TRIGGER:-PT1H',
  'END:VALARM',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:shared-1@teamsnap.com',
  'DTSTART:20261018T003000Z',
  'DTEND:20261018T013000Z',
  'SUMMARY:U7 Blue / U7 Red Practice',
  'LOCATION:Cliff McNabb Arena',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:game-1@teamsnap.com',
  'DTSTART;TZID=America/Vancouver:20261019T090000',
  'DURATION:PT1H15M',
  'SUMMARY:Game vs. Ladysmith',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:allday@teamsnap.com',
  'DTSTART;VALUE=DATE:20261020',
  'SUMMARY:Picture day',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:long-1@teamsnap.com',
  'DTSTART;TZID=America/Vancouver:20261022T171500',
  'DTEND;TZID=America/Vancouver:20261022T181500',
  'SUMMARY:Practice - Rink 1 with a very long title that folds',
  '  onto the next line',
  'STATUS:CANCELLED',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('reading an iCal feed', () => {
  const evs = parseIcs(feed);
  it('keeps timed events and drops all-day ones', () => {
    expect(evs.map((e) => e.uid)).toEqual(['practice-1@teamsnap.com', 'shared-1@teamsnap.com', 'game-1@teamsnap.com', 'long-1@teamsnap.com']);
  });
  it('reads local times, UTC times and lengths', () => {
    expect(evs[0]).toMatchObject({ date: '2026-10-15', startTime: '17:45', minutes: 60, rink: 'Frank Crane Arena - Rink 2', kind: 'practice' });
    expect(evs[1]).toMatchObject({ date: '2026-10-17', startTime: '17:30', minutes: 60 });
    expect(evs[2]).toMatchObject({ kind: 'game', minutes: 75 });
  });
  it('spots shared ice and cancelled events', () => {
    expect(evs[1].sharedWith).toBe('U7 Red');
    expect(evs[3].cancelled).toBe(true);
    expect(evs[3].title).toContain('onto the next line');
  });
  it('never keeps descriptions', () => {
    expect(JSON.stringify(evs)).not.toContain('Arrive 20 min');
  });
});

describe('classifying titles', () => {
  // Titles from a real Nanaimo U7 TeamSnap schedule, plus a few common ones.
  it.each([
    ['Practice', 'practice'],
    ['Practicd', 'practice'],
    ['U7 Blue Ice Time', 'practice'],
    ['Skills session', 'practice'],
    ["at NANAIMO MHA (1) U6/U7 'C'3 CLIPPERS", 'game'],
    ['U7 Blue vs U7 Green', 'game'],
    ['Snow and Sticks Oceanside Jamboree', 'game'],
    ['Team / Individual Photo Day', 'other'],
    ['Paradise Island Cheese Fundraiser Deadline', 'other'],
    ['Country Grocer Hotdog Fundraiser', 'other'],
  ])('%s → %s', (t, k) => expect(classify(t).kind).toBe(k));
  it('reads the other team', () => {
    expect(classify("at NANAIMO MHA (1) U6/U7 'C'3 CLIPPERS").sharedWith).toBe("NANAIMO MHA (1) U6/U7 'C'3 CLIPPERS");
    expect(classify('U7 Blue / U7 Red Practice').sharedWith).toBe('U7 Red');
    expect(classify('Team / Individual Photo Day').sharedWith).toBeNull();
  });
});

describe('calendar links', () => {
  it('accepts webcal and https links', () => {
    expect(normaliseCalendarUrl('webcal://ical-cdn.teamsnap.com/team_schedule/abc.ics')).toEqual({ ok: true, url: 'https://ical-cdn.teamsnap.com/team_schedule/abc.ics' });
    expect(normaliseCalendarUrl('http://ical-cdn.teamsnap.com/x.ics').ok).toBe(true);
  });
  it('refuses private and odd hosts', () => {
    for (const u of ['http://localhost/x.ics', 'http://10.0.0.1/x.ics', 'ftp://a.com/x', 'file:///etc/passwd', 'http://user:pw@a.com/x.ics', 'nonsense']) expect(normaliseCalendarUrl(u).ok).toBe(false);
  });
});
