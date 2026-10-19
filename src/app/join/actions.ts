'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';

/** Join the team behind a join link as a coach (decision 0011). */
export async function joinTeam(code: string) {
  const coach = await requireUser(`/join/${code}`);
  try {
    await (await getAppStore()).joinTeam(code, coach.id);
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    console.error('[join] joining failed:', m);
    redirect(`/join/${encodeURIComponent(code)}?error=${encodeURIComponent(m === 'link-off' || m === 'on-another-team' ? m : 'failed')}`);
  }
  revalidatePath('/', 'layout');
  redirect('/plans?joined=1');
}
