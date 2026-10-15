import 'server-only';
import type { AppStore } from '../app/store';
import { usingSupabase } from '../drills/store';
import { normaliseCalendarUrl, parseIcs, TEAM_TIME_ZONE, type IceEvent } from './ics';
import { mergeIceTimes } from './merge';

// Reads the team's calendar link and brings ice_times up to date. Runs on the server when a coach
// opens Plans (at most once an hour) or saves the link, as the signed-in coach, so RLS applies and
// no service key is needed (decision 0005).

const STALE_MS = 60 * 60 * 1000;
const MAX_BYTES = 2_000_000;
const WINDOW_DAYS = 200;

export const todayLocal = () => new Date().toLocaleDateString('en-CA', { timeZone: TEAM_TIME_ZONE });
const addDays = (iso: string, n: number) => new Date(new Date(iso + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);

/** Download and read a calendar link. Local mode may read a feed on localhost, for testing. */
export async function readCalendar(raw: string): Promise<{ ok: true; url: string; events: IceEvent[] } | { ok: false; error: string }> {
  const local = !usingSupabase() && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(raw.trim());
  const n = local ? { ok: true as const, url: raw.trim() } : normaliseCalendarUrl(raw);
  if (!n.ok) return n;
  let res: Response;
  try {
    // No redirects: a public link can't bounce the server to somewhere private.
    res = await fetch(n.url, { headers: { accept: 'text/calendar, text/plain;q=0.9' }, redirect: 'manual', signal: AbortSignal.timeout(8000), cache: 'no-store' });
  } catch {
    return { ok: false, error: 'Couldn’t reach that calendar. Check the link and try again.' };
  }
  if (res.status >= 300 && res.status < 400) return { ok: false, error: 'That link redirects somewhere else. Copy the calendar’s own iCal link.' };
  if (!res.ok) return { ok: false, error: `The calendar answered with an error (${res.status}). Check the link is still shared.` };
  const text = await res.text();
  if (text.length > MAX_BYTES) return { ok: false, error: 'That calendar is too big to read.' };
  if (!text.includes('BEGIN:VCALENDAR')) return { ok: false, error: 'That link isn’t a calendar feed. Look for “Subscribe” or an iCal (.ics) link.' };
  return { ok: true, url: n.url, events: parseIcs(text) };
}

export type SyncResult = { status: 'none' | 'fresh' } | { status: 'ok'; practices: number; games: number; moved: number } | { status: 'error'; error: string };

export async function syncCalendar(store: AppStore, teamId: string, opts: { force?: boolean } = {}): Promise<SyncResult> {
  const cal = await store.calendar(teamId);
  if (!cal) return { status: 'none' };
  if (!opts.force && cal.syncedAt && Date.now() - new Date(cal.syncedAt).getTime() < STALE_MS) return { status: 'fresh' };
  const read = await readCalendar(cal.url);
  if (!read.ok) return { status: 'error', error: read.error };
  const today = todayLocal();
  const fresh = read.events.filter((e) => e.date >= addDays(today, -1) && e.date <= addDays(today, WINDOW_DAYS));
  const known = (await store.iceTimes(teamId)).filter((k) => k.date >= addDays(today, -1));
  const { rows, moves } = mergeIceTimes(fresh, known, today);
  await store.upsertIceTimes(teamId, rows);
  for (const m of moves) {
    const p = await store.getPractice(m.practiceId);
    if (p && p.teamId === teamId && p.status !== 'done') await store.savePractice({ ...p, date: m.date, startTime: m.startTime, minutes: Math.min(120, Math.max(20, m.minutes)) });
  }
  await store.markCalendarSynced(teamId, new Date().toISOString());
  return { status: 'ok', practices: fresh.filter((e) => e.kind === 'practice' && !e.cancelled).length, games: fresh.filter((e) => e.kind === 'game').length, moved: moves.length };
}
