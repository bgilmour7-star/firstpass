'use server';

import { revalidatePath } from 'next/cache';
import { requireTeam } from '@/lib/auth';
import { getAppStore, type Favorite } from '@/lib/app/store';
import { editorLabel } from '@/lib/plans/activity';

/** Star or unstar a drill for the whole team (decision 0012). */
export async function setTeamFavorite(drillId: string, on: boolean): Promise<{ ok: true; fav: Favorite | null } | { ok: false; error: string }> {
  const { coach, team } = await requireTeam('/drills');
  const editor = editorLabel(coach.email);
  try {
    await (await getAppStore()).setFavorite(team.id, coach.id, editor, drillId, on);
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (m === 'favorites-migration-missing') return { ok: false, error: 'Favourites aren’t set up in the database yet. Run supabase/migrations/20261023000000_team_favorites.sql.' };
    console.error('[favorites] saving failed:', m);
    return { ok: false, error: 'Couldn’t save that. Try again in a minute.' };
  }
  revalidatePath('/drills');
  return { ok: true, fav: on ? { by: editor, at: new Date().toISOString() } : null };
}
