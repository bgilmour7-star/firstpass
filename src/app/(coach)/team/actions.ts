'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireTeam, requireUser } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { teamSchema } from '@/lib/plans/schema';
import { readCalendar, syncCalendar, todayLocal } from '@/lib/calendar/sync';
import { inviteEmail } from '@/lib/email/account-emails';
import { SITE, sendEmail } from '@/lib/email/layout';

export async function createTeam(formData: FormData) {
  const coach = await requireUser('/team/new');
  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect('/team/new?error=name');
  const ageGroup = formData.get('age') === 'U9' ? 'U9' : 'U7';
  const iceRaw = String(formData.get('ice') ?? 'half');
  const ice = iceRaw === 'full' || iceRaw === 'varies' ? iceRaw : 'half';
  const store = await getAppStore();
  if (!(await store.myTeam(coach.id))) await store.createTeam(name.slice(0, 80), coach.id, { ageGroup, ice });
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

/** The coach's own after-practice email setting (decision 0010). Each coach decides for themselves. */
export async function setCheckinEmails(on: boolean): Promise<{ ok: boolean; error?: string }> {
  const { coach, team } = await requireTeam('/team');
  try {
    await (await getAppStore()).setCheckinEmails(team.id, coach.id, on);
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (m === 'email-migration-missing') return { ok: false, error: 'Emails aren’t set up in the database yet. Run supabase/migrations/20261021000000_checkin_emails.sql in the Supabase SQL editor.' };
    console.error('[checkin-email] saving the setting failed:', m);
    return { ok: false, error: 'Couldn’t save that. Try again in a minute.' };
  }
  return { ok: true };
}

type CoachResult = { ok: true; code?: string | null } | { ok: false; error: string };

function coachError(e: unknown): string {
  const m = e instanceof Error ? e.message : '';
  if (m === 'not-head-coach') return 'Only the head coach can do that.';
  if (m === 'not-yourself') return 'You can’t remove yourself: the team needs its head coach.';
  if (m === 'join-migration-missing') return 'Join links aren’t set up in the database yet. Run supabase/migrations/20261022000000_team_join_link.sql in the Supabase SQL editor.';
  console.error('[coaches] change failed:', m);
  return 'Couldn’t save that. Try again in a minute.';
}

/** Head coach: a new join link. Any old link stops working (decision 0011). */
export async function newJoinLink(): Promise<CoachResult> {
  const { team } = await requireTeam('/team');
  try {
    return { ok: true, code: await (await getAppStore()).newJoinCode(team.id) };
  } catch (e) {
    return { ok: false, error: coachError(e) };
  }
}

/** Head coach: turn the join link off. Coaches already on the team stay. */
export async function turnOffJoinLink(): Promise<CoachResult> {
  const { team } = await requireTeam('/team');
  try {
    await (await getAppStore()).turnOffJoinCode(team.id);
    return { ok: true, code: null };
  } catch (e) {
    return { ok: false, error: coachError(e) };
  }
}

/** Head coach: take a coach off the team. */
export async function removeCoach(userId: string): Promise<CoachResult> {
  const { team } = await requireTeam('/team');
  try {
    await (await getAppStore()).removeCoach(team.id, userId);
  } catch (e) {
    return { ok: false, error: coachError(e) };
  }
  revalidatePath('/team');
  return { ok: true };
}

/** Head coach: email the team's join link to a coach (decision 0013). Their address is filled in when they open it. */
export async function sendInvite(raw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { coach, team } = await requireTeam('/team');
  const to = raw.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: 'Enter their email, like coach@example.com.' };
  const store = await getAppStore();
  const [coaches, code] = await Promise.all([store.coaches(team.id), store.joinCode(team.id)]);
  if (coaches.find((c) => c.userId === coach.id)?.role !== 'head_coach') return { ok: false, error: 'Only the head coach can invite coaches.' };
  if (coaches.some((c) => c.email.toLowerCase() === to)) return { ok: false, error: 'They’re already on the team.' };
  if (!code) return { ok: false, error: 'Turn on the join link first.' };
  const joinUrl = `${SITE}/join/${code}?email=${encodeURIComponent(to)}`;
  const sent = await sendEmail(to, inviteEmail({ inviter: coach.name, teamName: team.name, to, joinUrl }), 'invite');
  return sent ? { ok: true } : { ok: false, error: 'Couldn’t send it just now. Copy the link and send it yourself.' };
}
