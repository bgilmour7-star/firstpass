'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { groupsSchema, gearSchema, teamSchema } from '@/lib/plans/schema';
import { FOCUS_ATTRIBUTES } from '@/lib/drills/schema';
import { readCalendar, syncCalendar, todayLocal } from '@/lib/calendar/sync';
import { guessIce, weeklySlots, type WeeklySlot } from '@/lib/plans/team-summary';
import { nextPracticeDate } from '@/lib/plans/next-date';
import { startPlan } from '@/lib/plans/start-plan';
import { inviteEmail } from '@/lib/email/account-emails';
import { SITE, sendEmail } from '@/lib/email/layout';
import { setActiveTeam } from '../actions';

// Create a team (decision 0026, W1b–W7 on the canvas). One question per screen on the client; this
// file reads the calendar link for the Ice times screen, saves the U11+ answer, and does the build.

export type CalendarGuess =
  | { ok: true; practices: number; from: string | null; to: string | null; slots: WeeklySlot[]; ice: 'half' | 'full' | 'varies'; why: string; minutes: number | null; first: { date: string; startTime: string; minutes: number; half: boolean } | null }
  | { ok: false; error: string };

/** Ice times screen: read the link once, nothing saved yet. */
export async function checkCalendar(raw: string): Promise<CalendarGuess> {
  await requireUser('/team/new');
  const read = await readCalendar(raw);
  if (!read.ok) return read;
  const today = todayLocal();
  const practices = read.events.filter((e) => e.kind === 'practice' && !e.cancelled && e.date >= today).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  const slots = weeklySlots(read.events, today);
  const g = guessIce(slots);
  const first = practices[0];
  return {
    ok: true,
    practices: practices.length,
    from: first?.date ?? null,
    to: practices.at(-1)?.date ?? null,
    slots,
    ice: g.ice,
    why: g.why,
    minutes: slots[0]?.minutes ?? null,
    first: first ? { date: first.date, startTime: first.startTime, minutes: first.minutes, half: Boolean(first.sharedWith) } : null,
  };
}

const olderInput = z.object({ ageGroup: z.enum(['U11', 'U13', 'U15+']), hardestPart: z.string().trim().max(1000), wantsCall: z.boolean() });

/** U11 or older: what's hardest, and whether Brett may call. Never kids' names (the screen says so). */
export async function sendOlderInterest(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const coach = await requireUser('/team/new');
  const parsed = olderInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Pick an age group.' };
  try {
    await (await getAppStore()).saveOlderInterest(coach.id, parsed.data);
    return { ok: true };
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (m === 'older-migration-missing') return { ok: false, error: 'This needs a one-time database update (supabase/migrations/20261028000000_multi_team_and_older_interest.sql).' };
    console.error('[team/new] older interest:', m);
    return { ok: false, error: 'Couldn’t send that just now. Try again in a minute.' };
  }
}

const wizardInput = z.object({
  name: teamSchema.shape.name,
  ageGroup: z.enum(['U5', 'U7', 'U9']),
  ice: z.enum(['half', 'full', 'varies']),
  practiceMinutes: z.number().int().min(20).max(120),
  newDrillsPerWeek: z.number().int().min(0).max(10),
  groups: groupsSchema,
  gear: gearSchema,
  focus: z.array(z.enum(FOCUS_ATTRIBUTES)).max(2),
  calendarUrl: z.string().trim().max(2000).nullable(),
  invites: z.array(z.string().trim().toLowerCase().email()).max(10),
});
export type WizardInput = z.infer<typeof wizardInput>;

/**
 * Check and build: create the team with this coach as head coach, make it the active team, connect
 * the calendar, invite the coaches, build the first practice the way decision 0023 does, and open it.
 */
export async function buildTeam(input: unknown): Promise<{ ok: false; error: string }> {
  const coach = await requireUser('/team/new');
  const parsed = wizardInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check your answers.' };
  const w = parsed.data;
  const store = await getAppStore();
  const coachesOnIce = Math.max(1, Math.min(10, 1 + w.invites.length));
  let planId: string;
  try {
    const team = await store.createTeam(w.name, coach.id, { ageGroup: w.ageGroup, ice: w.ice, practiceMinutes: w.practiceMinutes, newDrillsPerWeek: w.newDrillsPerWeek, groups: w.groups, gear: w.gear, focus: w.focus, coachesOnIce });
    await setActiveTeam(team.id);

    // The calendar: connect it and read it, so the first plan sits on the first real ice time.
    let ice: { id: string; date: string; startTime: string; minutes: number; half: boolean } | null = null;
    if (w.calendarUrl) {
      const read = await readCalendar(w.calendarUrl);
      if (read.ok) {
        await store.setCalendar(team.id, read.url).catch((e) => console.error('[team/new] calendar:', e instanceof Error ? e.message : e));
        await syncCalendar(store, team.id, { force: true }).catch(() => undefined);
        const today = todayLocal();
        const x = (await store.iceTimes(team.id).catch(() => [])).find((i) => i.kind === 'practice' && !i.cancelled && !i.ignored && i.date >= today);
        if (x) ice = { id: x.id, date: x.date, startTime: x.startTime, minutes: x.minutes, half: Boolean(x.sharedWith) };
      }
    }
    const at = ice
      ? { date: ice.date, startTime: ice.startTime, minutes: Math.min(120, Math.max(20, ice.minutes)), ice: ice.half ? ('half' as const) : undefined }
      : (nextPracticeDate([], [], todayLocal()) as { date: string; startTime: string });
    const { p } = await startPlan(store, team, coach.id, at);
    planId = p.id;
    if (ice) await store.setIceTime(ice.id, { practiceId: p.id }).catch(() => undefined);
    await store.addEdit({ practiceId: p.id, teamId: team.id, userId: coach.id, editor: coach.name, summary: 'started the plan', base: null }).catch(() => undefined);

    // Invites go out with the team's join link (decision 0013). Never blocks building the team.
    if (w.invites.length) {
      try {
        const code = await store.newJoinCode(team.id);
        await Promise.all(w.invites.filter((to) => to !== coach.email.toLowerCase()).map((to) => sendEmail(to, inviteEmail({ inviter: coach.name, teamName: team.name, to, joinUrl: `${SITE}/join/${code}?email=${encodeURIComponent(to)}` }), 'invite')));
      } catch (e) {
        console.error('[team/new] invites:', e instanceof Error ? e.message : e);
      }
    }
  } catch (e) {
    console.error('[team/new] building the team failed:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'Couldn’t set up the team just now. Try again in a minute.' };
  }
  revalidatePath('/', 'layout');
  redirect(`/plans/${planId}`);
}
