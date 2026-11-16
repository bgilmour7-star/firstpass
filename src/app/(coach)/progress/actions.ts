'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireTeam } from '@/lib/auth';
import { ATTRIBUTES } from '@/lib/progress/levels';
import { getProgressStore } from '@/lib/progress/store';

// Progress scoring (decision 0030). The database checks the round is open, the coach scores, and the
// counts fit the team; this only shapes the input.

const counts = z.tuple([z.number().int().min(0), z.number().int().min(0), z.number().int().min(0), z.number().int().min(0), z.number().int().min(0)]);
const input = z.object({
  roundId: z.string().min(1),
  answers: z.record(z.enum(ATTRIBUTES), counts),
  done: z.array(z.enum(ATTRIBUTES)),
  noChange: z.array(z.enum(ATTRIBUTES)),
  seconds: z.number().int().min(0).max(24 * 3600),
  finish: z.boolean(),
});

const MESSAGES: Record<string, string> = {
  'round-closed': 'This month’s scoring has closed. The next one opens after the first practice of next month.',
  'not-scoring': 'Your head coach has turned off progress scoring for you on this team.',
  'bad-counts': 'Those numbers don’t fit the team. Check each level adds up to your skaters.',
  'progress-migration-missing': 'Progress scoring needs its database update first.',
};

export async function saveProgress(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { coach, team } = await requireTeam('/progress');
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Something didn’t add up. Try again.' };
  try {
    await (await getProgressStore()).saveScore(team.id, coach.id, parsed.data);
  } catch (e) {
    const key = e instanceof Error ? e.message : '';
    return { ok: false, error: MESSAGES[key] ?? 'Couldn’t save. Check your connection and try again.' };
  }
  if (parsed.data.finish) revalidatePath('/progress');
  return { ok: true };
}

/** Head coach: whether a coach on the team scores progress. */
export async function setProgressScoring(userId: string, on: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const { team } = await requireTeam('/team');
  try {
    await (await getProgressStore()).setScoring(team.id, userId, on);
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message === 'not-head-coach' ? 'Only the head coach can change this.' : 'Couldn’t save that.' };
  }
  revalidatePath('/team');
  return { ok: true };
}

/** Each coach: whether they get the monthly progress emails. */
export async function setProgressEmails(on: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const { coach, team } = await requireTeam('/team');
  try {
    await (await getProgressStore()).setEmails(team.id, coach.id, on);
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message === 'progress-migration-missing' ? 'Progress emails need their database update first.' : 'Couldn’t save that.' };
  }
  return { ok: true };
}

/** Head coach: email the coaches who haven't scored this month, now (once each per month). */
export async function sendProgressReminder(roundId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { team } = await requireTeam('/progress');
  if (typeof roundId !== 'string' || !roundId) return { ok: false, error: 'Something didn’t add up.' };
  const store = await getProgressStore();
  const rounds = (await store.rounds(team.id)) ?? [];
  if (!rounds.some((r) => r.id === roundId)) return { ok: false, error: 'That isn’t your team’s month.' };
  try {
    await store.remind(roundId);
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    return { ok: false, error: m === 'not-head-coach' ? 'Only the head coach can send a reminder.' : m === 'round-closed' ? 'This month’s scoring has closed.' : m === 'progress-migration-missing' ? 'Reminders need their database update first.' : 'Couldn’t send that.' };
  }
  revalidatePath('/progress');
  return { ok: true };
}
