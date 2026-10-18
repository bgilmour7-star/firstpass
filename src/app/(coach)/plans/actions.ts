'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { copyBlocks, practiceSchema, starterBlocks, type Practice, type Team } from '@/lib/plans/schema';
import { SESSION_MS, describeChange, editorLabel, type Snapshot } from '@/lib/plans/activity';
import type { AppStore } from '@/lib/app/store';

const snap = (p: Practice): Snapshot => ({ blocks: p.blocks, status: p.status, attendance: p.attendance, minutes: p.minutes, startTime: p.startTime, date: p.date });
const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * One line in the practice's edit log. Saves by the same coach within SESSION_MS merge into one
 * entry whose summary compares against the plan as it was when they started. Never blocks a save.
 */
async function logEdit(store: AppStore, coach: { id: string; email: string }, before: Practice, after: Practice, fixed?: string) {
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
    else await store.addEdit({ practiceId: after.id, teamId: after.teamId, userId: coach.id, editor: editorLabel(coach.email), summary, base: fixed ? null : base });
  } catch (e) {
    console.error('[plans] edit log:', e);
  }
}

/** A new plan starts as a copy of the most recent one before it (design decision). */
async function startPlan(team: Team, coachId: string, at: { date: string; startTime: string; minutes?: number; ice?: Practice['ice'] }) {
  const store = await getAppStore();
  const last = (await store.listPractices(team.id)).filter((p) => p.date <= at.date)[0];
  const p = await store.createPractice(
    {
      teamId: team.id,
      date: at.date,
      startTime: at.startTime,
      minutes: at.minutes ?? last?.minutes ?? team.practiceMinutes,
      ice: at.ice ?? (team.ice === 'full' ? 'full' : 'half'),
      status: 'draft',
      blocks: last ? copyBlocks(last.blocks) : starterBlocks(at.minutes ?? team.practiceMinutes),
      // Who's here is set fresh for each practice; it starts as the team's usual groups.
      attendance: null,
    },
    coachId,
  );
  return { p, last };
}

async function logCreated(coach: { id: string; email: string }, p: Practice, last: Practice | undefined) {
  const store = await getAppStore();
  await logEdit(store, coach, p, p, last ? `copied it from ${shortDay(last.date)}` : 'started the plan');
}

export async function createPractice(formData: FormData) {
  const { coach, team } = await requireTeam('/plans');
  const date = String(formData.get('date') ?? '');
  const startTime = String(formData.get('time') ?? '17:45');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime)) redirect('/plans?error=date');
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
