import 'server-only';
import { redirect } from 'next/navigation';
import { usingSupabase } from './drills/store';
import { getAppStore } from './app/store';
import type { Team } from './plans/schema';

export type Admin = { id: string; email: string; local: boolean };
export type Coach = { id: string; email: string; local: boolean; isAdmin: boolean };

async function currentUser(nextPath: string): Promise<{ id: string; email: string; local: boolean; isAdmin: boolean }> {
  if (!usingSupabase()) return { id: 'local', email: 'Local coach', local: true, isAdmin: true };
  const { supabaseServer } = await import('./supabase/server');
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  const { data: isAdmin } = await supabase.rpc('is_admin');
  return { id: data.user.id, email: data.user.email ?? 'Coach', local: false, isAdmin: Boolean(isAdmin) };
}

// Every admin page and server action calls this first. RLS enforces the same rule in the database.
export async function requireAdmin(nextPath = '/admin/drills'): Promise<Admin> {
  const u = await currentUser(nextPath);
  if (!u.isAdmin) redirect('/not-allowed');
  return { id: u.id, email: u.email === 'Local coach' ? 'Local admin' : u.email, local: u.local };
}

/** Signed in, any role. Coach pages call requireTeam() instead. */
export async function requireUser(nextPath = '/plans'): Promise<Coach> {
  return currentUser(nextPath);
}

/** Signed in and on a team. No team yet → the one-step team setup. */
export async function requireTeam(nextPath = '/plans'): Promise<{ coach: Coach; team: Team }> {
  const coach = await currentUser(nextPath);
  const team = await (await getAppStore()).myTeam(coach.id);
  if (!team) redirect('/team/new');
  return { coach, team };
}
