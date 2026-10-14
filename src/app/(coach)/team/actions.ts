'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireTeam, requireUser } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { teamSchema } from '@/lib/plans/schema';

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
