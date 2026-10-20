'use server';

import { revalidatePath } from 'next/cache';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { getRequestStore } from '@/lib/requests/store';
import { OPEN_LIMIT, requestInput } from '@/lib/requests/schema';

// A coach asks for a new drill or suggests a change (decision 0018). Claude drafts it once a day;
// an admin reviews it; the coach hears back by email.
export async function sendDrillRequest(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { coach, team } = await requireTeam('/drills');
  const parsed = requestInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  const input = parsed.data;
  if (input.kind === 'change' && !(await (await getAppStore()).libraryDrills()).some((d) => d.id === input.drillId)) {
    return { ok: false, error: 'That drill isn’t in the library any more.' };
  }
  try {
    await (await getRequestStore()).create(input, { teamId: team.id, userId: coach.id, name: coach.name, email: coach.email });
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (m === 'request-limit') return { ok: false, error: `Your team has ${OPEN_LIMIT} requests waiting. Send this one once one of them is done.` };
    if (m === 'requests-migration-missing') return { ok: false, error: 'Drill requests aren’t set up in the database yet. Run supabase/migrations/20261025000000_drill_requests.sql.' };
    console.error('[requests] sending failed:', m);
    return { ok: false, error: 'Couldn’t send that. Try again in a minute.' };
  }
  revalidatePath('/drills');
  return { ok: true };
}
