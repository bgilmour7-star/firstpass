// Reading a team's schedule from an iCal link (TeamSnap, Google Calendar, an association feed).
// We keep only what a plan needs: when, how long, which rink, the title, and whether it's a
// practice, a game or something else. Descriptions and attendees are never read into storage.

export type IceKind = 'practice' | 'game' | 'other';

export type IceEvent = {
  uid: string;
  date: string; // YYYY-MM-DD, team's local time
  startTime: string; // HH:MM, team's local time
  minutes: number;
  title: string;
  rink: string;
  kind: IceKind;
  /** Another team named in a practice title ("U7 Blue / U7 Red"): they're on the other half. */
  sharedWith: string | null;
  cancelled: boolean;
};

export const TEAM_TIME_ZONE = 'America/Vancouver';

/** webcal:// links are https underneath. Only http(s) to a public host is accepted. */
export function normaliseCalendarUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const s = raw.trim().replace(/^webcals?:\/\//i, 'https://');
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { ok: false, error: 'That doesn’t look like a link. Copy the calendar (iCal) link from your schedule app.' };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, error: 'Use the calendar link that starts with https or webcal.' };
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || /^(\d+\.){3}\d+$/.test(host) || host.includes(':') || !host.includes('.'))
    return { ok: false, error: 'Use the public calendar link from your schedule app.' };
  if (u.username || u.password) return { ok: false, error: 'Use the public calendar link from your schedule app.' };
  // Calendar hosts serve https; never send the link in the clear.
  if (u.protocol === 'http:') u.protocol = 'https:';
  return { ok: true, url: u.toString() };
}

/** Unfold continuation lines (RFC 5545: a line starting with a space or tab continues the last). */
function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function unescape(v: string): string {
  return v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
}

type Prop = { name: string; params: Record<string, string>; value: string };
function parseLine(line: string): Prop | null {
  const i = line.indexOf(':');
  if (i < 0) return null;
  const [name, ...params] = line.slice(0, i).split(';');
  const p: Record<string, string> = {};
  params.forEach((x) => {
    const [k, v] = x.split('=');
    if (k && v) p[k.toUpperCase()] = v.replace(/^"|"$/g, '');
  });
  return { name: name.toUpperCase(), params: p, value: line.slice(i + 1) };
}

/** Wall-clock parts of an instant in a time zone. */
function partsIn(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const o = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${o.year}-${o.month}-${o.day}`, time: `${o.hour}:${o.minute}` };
}

/** The UTC instant of a wall-clock time in a time zone. */
function instantOf(y: number, mo: number, d: number, h: number, mi: number, tz: string): Date {
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const shown = partsIn(guess, tz);
  const [sy, smo, sd] = shown.date.split('-').map(Number);
  const [sh, smi] = shown.time.split(':').map(Number);
  const offset = Date.UTC(sy, smo - 1, sd, sh, smi) - guess.getTime();
  return new Date(guess.getTime() - offset);
}

/** DTSTART / DTEND → an instant. Floating times are read in the calendar's zone, else the team's. */
function toInstant(p: Prop, calendarTz: string): { at: Date; allDay: boolean } | null {
  const m = p.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (!h) return { at: instantOf(+y, +mo, +d, 0, 0, calendarTz), allDay: true };
  if (z) return { at: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi)), allDay: false };
  return { at: instantOf(+y, +mo, +d, +h, +mi, p.params.TZID || calendarTz), allDay: false };
}

function durationMinutes(v: string): number | null {
  const m = v.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return null;
  return (+(m[1] ?? 0)) * 1440 + (+(m[2] ?? 0)) * 60 + +(m[3] ?? 0);
}

/**
 * What kind of ice time a title describes, from real TeamSnap titles:
 * - Games: "at NANAIMO MHA (1) U6/U7 'C'3 CLIPPERS", "vs Ladysmith", "Game", "Jamboree". For a game,
 *   `sharedWith` is the other team.
 * - Practices: "Practice" (and typos like "Practicd"), "Ice time", "Skills", "Session".
 *   "U7 Blue / U7 Red Practice" is shared ice: the other team is on the other half.
 * - Anything else (photo day, fundraiser) is "other" and stays out of the way.
 */
export function classify(title: string): { kind: IceKind; sharedWith: string | null } {
  const t = title.trim();
  const opp = t.match(/^(?:at|vs\.?|versus|@)\s+(.+)$/i) ?? t.match(/\s(?:vs\.?|versus|@)\s+(.+)$/i);
  if (opp) return { kind: 'game', sharedWith: opp[1].trim().slice(0, 80) };
  if (/\b(game|tournament|jamboree|exhibition|playoff|festival)\b/i.test(t)) return { kind: 'game', sharedWith: null };
  const practiceWord = /\b(practi\w*|ice time|ice|skills?|skate|session|development|clinic)\b/i.test(t);
  // Shared ice: two team names joined by " / ", " & " or " + " in a practice title, or both naming an age group.
  const m = t.match(/^(.*?\S)\s+[/&+]\s+(\S.*?)(?:\s+(?:practi\w*|ice time|ice|skills?|session)\b.*)?$/i);
  const shared = m && (practiceWord || (/\bU\d+/i.test(m[1]) && /\bU\d+/i.test(m[2]))) ? m[2].trim().slice(0, 80) : null;
  return { kind: practiceWord || shared ? 'practice' : 'other', sharedWith: shared };
}

export function parseIcs(text: string, teamTz = TEAM_TIME_ZONE): IceEvent[] {
  const lines = unfold(text);
  let calendarTz = teamTz;
  const out: IceEvent[] = [];
  let ev: Prop[] | null = null;
  let depth = 0; // nested blocks inside a VEVENT (VALARM)
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('X-WR-TIMEZONE:')) calendarTz = line.slice(14).trim() || calendarTz;
    if (line === 'BEGIN:VEVENT') {
      ev = [];
      depth = 0;
      continue;
    }
    if (!ev) continue;
    if (line.startsWith('BEGIN:')) depth++;
    else if (line.startsWith('END:') && line !== 'END:VEVENT') depth--;
    else if (line === 'END:VEVENT') {
      const e = toEvent(ev, calendarTz, teamTz);
      if (e) out.push(e);
      ev = null;
    } else if (depth === 0) {
      const p = parseLine(line);
      if (p) ev.push(p);
    }
  }
  return out.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
}

function toEvent(props: Prop[], calendarTz: string, teamTz: string): IceEvent | null {
  const get = (n: string) => props.find((p) => p.name === n);
  const uid = get('UID')?.value.trim();
  const start = get('DTSTART');
  if (!uid || !start) return null;
  const s = toInstant(start, calendarTz);
  if (!s || s.allDay) return null; // all-day items aren't ice times
  const end = get('DTEND');
  const e = end ? toInstant(end, calendarTz) : null;
  const dur = get('DURATION');
  const minutes = e ? Math.round((e.at.getTime() - s.at.getTime()) / 60000) : dur ? (durationMinutes(dur.value) ?? 60) : 60;
  const local = partsIn(s.at, teamTz);
  const title = unescape(get('SUMMARY')?.value ?? 'Ice time').slice(0, 120);
  const rink = unescape(get('LOCATION')?.value ?? '')
    .split(/\s{2,}|\n/)[0]
    .slice(0, 120);
  const { kind, sharedWith } = classify(title);
  const status = get('STATUS')?.value.toUpperCase();
  return { uid: uid.slice(0, 200), date: local.date, startTime: local.time, minutes: Math.max(5, Math.min(240, minutes || 60)), title, rink, kind, sharedWith, cancelled: status === 'CANCELLED' || /\bcancel(l)?ed\b/i.test(title) };
}
