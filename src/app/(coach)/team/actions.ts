'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireTeam, requireUser } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { teamSchema } from '@/lib/plans/schema';
import { readCalendar, syncCalendar, todayLocal } from '@/lib/calendar/sync';

export async function createTeam(formData: FormData) {
  const coach = await requireUser('/team/new');
  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect('/team/new?error=name');
  const store = await getAppStore();
  if (!(await store.myTeam(coach.id))) await store.createTeam(name.slice(0, 80), coach.id);
  redirect('/team?welcome=1');
}

export async function saveTeam(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { team } = await requireTeam('/team');
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the fields.' };
  if (parsed.data.id !== team.id) return { ok: false, error: 'You can only edit your own team.' };
  try {
    await (await getAppStore()).updateTeam(parsed.data);
  } catch {
    return { ok: false, error: 'Only the head coach can change team settings.' };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export type CalendarCheck = { ok: true; practices: number; games: number; next: { date: string; startTime: string; title: string; rink: string; sharedWith: string | null }[] } | { ok: false; error: string };

/** Save the team's calendar link (head coach), read it once and say what it found. */
export async function saveCalendar(raw: string): Promise<CalendarCheck> {
  const { team } = await requireTeam('/team');
  const read = await readCalendar(raw);
  if (!read.ok) return read;
  const store = await getAppStore();
  try {
    await store.setCalendar(team.id, read.url);
  } catch (e) {
    return { ok: false, error: calendarError(e) };
  }
  const sync = await syncCalendar(store, team.id, { force: true });
  if (sync.status === 'error') return { ok: false, error: sync.error };
  const today = todayLocal();
  const next = read.events
    .filter((e) => e.kind === 'practice' && !e.cancelled && e.date >= today)
    .slice(0, 4)
    .map(({ date, startTime, title, rink, sharedWith }) => ({ date, startTime, title, rink, sharedWith }));
  revalidatePath('/plans');
  return { ok: true, practices: sync.status === 'ok' ? sync.practices : 0, games: sync.status === 'ok' ? sync.games : 0, next };
}

export async function removeCalendar(): Promise<{ ok: boolean; error?: string }> {
  const { team } = await requireTeam('/team');
  try {
    await (await getAppStore()).setCalendar(team.id, null);
  } catch (e) {
    return { ok: false, error: calendarError(e) };
  }
  revalidatePath('/plans');
  return { ok: true };
}

function calendarError(e: unknown): string {
  const m = e instanceof Error ? e.message : '';
  if (m === 'calendar-migration-missing') return 'The calendar isn’t set up in the database yet. Run supabase/migrations/20261016000000_calendar.sql in the Supabase SQL editor, then try again.';
  if (m === 'not-head-coach') return 'Only the head coach can change the calendar link.';
  console.error('[calendar] saving the link failed:', m);
  return 'Couldn’t save the link. Try again in a minute.';
}
