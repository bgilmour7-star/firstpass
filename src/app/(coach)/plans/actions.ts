'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { copyBlocks, practiceSchema, type Practice, type Team } from '@/lib/plans/schema';
import { firstPlan } from '@/lib/plans/first-plan';
import { drillsForAge } from '@/lib/drills/age';
import { SESSION_MS, describeChange, type Snapshot } from '@/lib/plans/activity';
import type { AppStore } from '@/lib/app/store';
import { checkinInput, cleanMarks, practiceOver, rateUnits } from '@/lib/plans/checkin';

const snap = (p: Practice): Snapshot => ({ blocks: p.blocks, status: p.status, attendance: p.attendance, minutes: p.minutes, startTime: p.startTime, date: p.date });
const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * One line in the practice's edit log. Saves by the same coach within SESSION_MS merge into one
 * entry whose summary compares against the plan as it was when they started. Never blocks a save.
 */
async function logEdit(store: AppStore, coach: { id: string; name: string }, before: Practice, after: Practice, fixed?: string) {
  try {
    const last = await store.latestEdit(after.id);
    // Fixed events (created, shared) store no base, so later edits start a new entry instead of overwriting them.
    const sameSession = last && last.base && last.userId === coach.id && Date.now() - new Date(last.at).getTime() < SESSION_MS;
    const base = sameSession ? last.base! : snap(before);
    let summary = fixed;
    if (!summary) {
      const names = new Map((await store.libraryDrills()).map((d) => [d.id, d.funName]));
      summary = describeChange(base, snap(after), (id) => names.get(id));
    }
    if (sameSession && !fixed) await store.updateEdit(last.id, { summary, at: new Date().toISOString() });
    else await store.addEdit({ practiceId: after.id, teamId: after.teamId, userId: coach.id, editor: coach.name, summary, base: fixed ? null : base });
  } catch (e) {
    console.error('[plans] edit log:', e);
  }
}

/** A new plan starts as a copy of the most recent one before it (design decision). */
async function startPlan(team: Team, coachId: string, at: { date: string; startTime: string; minutes?: number; ice?: Practice['ice'] }) {
  const store = await getAppStore();
  const last = (await store.listPractices(team.id)).filter((p) => p.date <= at.date)[0];
  // No plan to copy yet: the first one comes ready to run (decision 0023).
  const groups = team.groups.filter((g) => g.skaters > 0).length || 3;
  const blocks = last ? copyBlocks(last.blocks) : firstPlan(at.minutes ?? team.practiceMinutes, drillsForAge(await store.libraryDrills(), team.ageGroup).drills, groups, team.ageGroup);
  const p = await store.createPractice(
    {
      teamId: team.id,
      date: at.date,
      startTime: at.startTime,
      minutes: at.minutes ?? last?.minutes ?? team.practiceMinutes,
      ice: at.ice ?? (team.ice === 'full' ? 'full' : 'half'),
      status: 'draft',
      blocks,
      // Who's here is set fresh for each practice; it starts as the team's usual groups.
      attendance: null,
    },
    coachId,
  );
  return { p, last };
}

async function logCreated(coach: { id: string; name: string }, p: Practice, last: Practice | undefined) {
  const store = await getAppStore();
  await logEdit(store, coach, p, p, last ? `copied it from ${shortDay(last.date)}` : 'started the plan');
}

/** "Add a practice": a date and start the coach chose (prefilled with a guess, decision 0017). If it matches an
 * unplanned ice time from the calendar, the plan takes that ice time (length, half ice) as "Plan it" would. */
export async function createPractice(formData: FormData) {
  const { coach, team } = await requireTeam('/plans');
  const date = String(formData.get('date') ?? '');
  const startTime = String(formData.get('time') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime)) redirect('/plans');
  const store = await getAppStore();
  const [plans, ice] = await Promise.all([store.listPractices(team.id), store.iceTimes(team.id).catch(() => [])]);
  const planned = new Set(plans.map((p) => p.id));
  const match = ice.find((x) => x.date === date && x.startTime === startTime && !x.cancelled && !(x.practiceId && planned.has(x.practiceId)));
  if (match) return planIceTime(match.id);
  const { p, last } = await startPlan(team, coach.id, { date, startTime });
  await logCreated(coach, p, last);
  revalidatePath('/plans');
  redirect(`/plans/${p.id}${last ? '?copied=' + last.date : ''}`);
}

/** "Plan it" on an ice time from the calendar: date, time and length come from the calendar. */
export async function planIceTime(iceId: string) {
  const { coach, team } = await requireTeam('/plans');
  const store = await getAppStore();
  const ice = (await store.iceTimes(team.id)).find((x) => x.id === iceId);
  if (!ice) redirect('/plans');
  if (ice.practiceId && (await store.getPractice(ice.practiceId))) redirect(`/plans/${ice.practiceId}`);
  const minutes = Math.min(120, Math.max(20, ice.minutes));
  const { p, last } = await startPlan(team, coach.id, { date: ice.date, startTime: ice.startTime, minutes, ice: ice.sharedWith ? 'half' : undefined });
  await logCreated(coach, p, last);
  await store.setIceTime(ice.id, { practiceId: p.id });
  revalidatePath('/plans');
  redirect(`/plans/${p.id}${last ? '?copied=' + last.date : ''}`);
}

/** "Not ours" hides an ice time; "Show again" brings it back. */
export async function ignoreIceTime(iceId: string, ignored: boolean) {
  const { team } = await requireTeam('/plans');
  const store = await getAppStore();
  if ((await store.iceTimes(team.id)).some((x) => x.id === iceId)) await store.setIceTime(iceId, { ignored });
  revalidatePath('/plans');
}

export async function savePractice(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { coach, team } = await requireTeam('/plans');
  const parsed = practiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the plan.' };
  const store = await getAppStore();
  const existing = await store.getPractice(parsed.data.id);
  if (!existing || existing.teamId !== team.id || parsed.data.teamId !== team.id) return { ok: false, error: 'This plan belongs to another team.' };
  await store.savePractice(parsed.data);
  if (JSON.stringify(snap(existing)) !== JSON.stringify(snap(parsed.data))) await logEdit(store, coach, existing, parsed.data);
  revalidatePath('/plans');
  return { ok: true };
}

/** "Keep as is" on a suggestion from the check-in (decision 0022): hidden for every coach on the team. */
export async function keepSuggestion(practiceId: string, key: string): Promise<{ ok: true; editor: string } | { ok: false; error: string }> {
  const { coach, team } = await requireTeam('/plans');
  if (!/^(flop|steam):[a-z0-9-]{1,70}$|^ready$/.test(key)) return { ok: false, error: 'Unknown suggestion.' };
  const store = await getAppStore();
  const p = await store.getPractice(practiceId);
  if (!p || p.teamId !== team.id) return { ok: false, error: 'This plan belongs to another team.' };
  try {
    await store.keepSuggestion({ practiceId, teamId: team.id, userId: coach.id, editor: coach.name, key });
    return { ok: true, editor: coach.name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save that.' };
  }
}

export async function deletePractice(id: string) {
  const { team } = await requireTeam('/plans');
  const store = await getAppStore();
  const existing = await store.getPractice(id);
  if (existing && existing.teamId === team.id) await store.deletePractice(id);
  revalidatePath('/plans');
  redirect('/plans');
}

export async function shareWithParents(practiceId: string): Promise<{ ok: true; token: string; expiresAt: string } | { ok: false; error: string }> {
  const { coach, team } = await requireTeam('/plans');
  const store = await getAppStore();
  const p = await store.getPractice(practiceId);
  if (!p || p.teamId !== team.id) return { ok: false, error: 'This plan belongs to another team.' };
  const active = await store.activeShare(practiceId);
  const share = active ?? (await store.createShare(practiceId, team.id, coach.id));
  if (!active) await logEdit(store, coach, p, p, 'shared it with parents');
  return { ok: true, ...share };
}

export async function stopSharing(practiceId: string): Promise<{ ok: boolean }> {
  const { team } = await requireTeam('/plans');
  const store = await getAppStore();
  const p = await store.getPractice(practiceId);
  if (!p || p.teamId !== team.id) return { ok: false };
  await store.revokeShares(practiceId);
  return { ok: true };
}

/** A coach's after-practice check-in. One per coach per practice; saving again replaces it. */
export async function saveCheckin(practiceId: string, input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { coach, team } = await requireTeam('/plans');
  const parsed = checkinInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Something in the check-in didn’t look right. Try again.' };
  const store = await getAppStore();
  const p = await store.getPractice(practiceId);
  if (!p || p.teamId !== team.id) return { ok: false, error: 'This practice belongs to another team.' };
  const byId = new Map((await store.libraryDrills()).map((d) => [d.id, d]));
  const units = rateUnits(p, team, byId);
  const c = parsed.data;
  const lost = c.steam === 'bored' || c.steam === 'tired';
  try {
    await store.saveCheckin({
      ...c,
      marks: cleanMarks(c.marks, units),
      steamFrom: lost && c.steamFrom && units.some((u) => u.key === c.steamFrom) ? c.steamFrom : null,
      practiceId: p.id,
      teamId: team.id,
      userId: coach.id,
      editor: coach.name,
      savedAt: new Date().toISOString(),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Couldn’t save the check-in.' };
  }
  // A practice someone has checked in on has happened.
  if (p.status !== 'done' && practiceOver(p)) await store.savePractice({ ...p, status: 'done' });
  revalidatePath('/plans');
  revalidatePath(`/plans/${p.id}/check-in`);
  return { ok: true };
}
