'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { copyBlocks, practiceSchema, starterBlocks } from '@/lib/plans/schema';

export async function createPractice(formData: FormData) {
  const { coach, team } = await requireTeam('/plans');
  const date = String(formData.get('date') ?? '');
  const startTime = String(formData.get('time') ?? '17:45');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime)) redirect('/plans?error=date');
  const store = await getAppStore();
  // The next practice starts as a copy of the most recent one before it (design decision).
  const before = (await store.listPractices(team.id)).filter((p) => p.date <= date);
  const last = before[0];
  const p = await store.createPractice(
    {
      teamId: team.id,
      date,
      startTime,
      minutes: last?.minutes ?? team.practiceMinutes,
      ice: team.ice === 'full' ? 'full' : 'half',
      status: 'draft',
      blocks: last ? copyBlocks(last.blocks) : starterBlocks(team.practiceMinutes),
    },
    coach.id,
  );
  revalidatePath('/plans');
  redirect(`/plans/${p.id}${last ? '?copied=' + last.date : ''}`);
}

export async function savePractice(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { team } = await requireTeam('/plans');
  const parsed = practiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the plan.' };
  const store = await getAppStore();
  const existing = await store.getPractice(parsed.data.id);
  if (!existing || existing.teamId !== team.id || parsed.data.teamId !== team.id) return { ok: false, error: 'This plan belongs to another team.' };
  await store.savePractice(parsed.data);
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
