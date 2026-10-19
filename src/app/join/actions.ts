'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { notifyHeadCoach } from '@/lib/auth-after';
import { usingSupabase } from '@/lib/drills/store';

/** Already signed in: join the team behind a join link as a coach (decisions 0011, 0013). */
export async function joinTeam(code: string) {
  const coach = await requireUser(`/join/${code}`);
  const store = await getAppStore();
  try {
    const before = await store.myTeam(coach.id);
    const teamId = await store.joinTeam(code, coach.id);
    if (usingSupabase() && before?.id !== teamId) {
      const { supabaseServer } = await import('@/lib/supabase/server');
      await notifyHeadCoach(await supabaseServer(), teamId, coach.id);
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    console.error('[join] joining failed:', m);
    redirect(`/join/${encodeURIComponent(code)}?error=${encodeURIComponent(m === 'link-off' || m === 'on-another-team' ? m : 'failed')}`);
  }
  revalidatePath('/', 'layout');
  redirect(`/join/${encodeURIComponent(code)}/joined`);
}
