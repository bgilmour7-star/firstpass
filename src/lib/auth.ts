import 'server-only';
import { redirect } from 'next/navigation';
import { usingSupabase } from './drills/store';
import { getAppStore } from './app/store';
import type { Team } from './plans/schema';
import { editorLabel } from './plans/activity';

export type Admin = { id: string; email: string; local: boolean };
/** name: the first name the coach gave at sign-up, else one made from their email (decision 0013). */
export type Coach = { id: string; email: string; name: string; hasPassword: boolean; local: boolean; isAdmin: boolean };

async function currentUser(nextPath: string): Promise<Coach> {
  if (!usingSupabase()) return { id: 'local', email: 'Local coach', name: 'Coach', hasPassword: true, local: true, isAdmin: true };
  const { supabaseServer } = await import('./supabase/server');
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  const { data: isAdmin } = await supabase.rpc('is_admin');
  const meta = (data.user.user_metadata ?? {}) as { first_name?: string; has_password?: boolean };
  const email = data.user.email ?? 'Coach';
  return { id: data.user.id, email, name: meta.first_name?.trim() || editorLabel(email), hasPassword: meta.has_password === true, local: false, isAdmin: Boolean(isAdmin) };
}

// Every admin page and server action calls this first. RLS enforces the same rule in the database.
export async function requireAdmin(nextPath = '/admin/drills'): Promise<Admin> {
  const u = await currentUser(nextPath);
  // Coaches who aren't admins land on their plans (the sign-in email points at drill review).
  if (!u.isAdmin) redirect('/');
  return { id: u.id, email: u.email === 'Local coach' ? 'Local admin' : u.email, local: u.local };
}

/** Signed in or not, without sending anyone to /login (the join page, decision 0013). */
export async function optionalUser(): Promise<Coach | null> {
  if (!usingSupabase()) return currentUser('/');
  const { supabaseServer } = await import('./supabase/server');
  const { data } = await (await supabaseServer()).auth.getUser();
  return data.user ? currentUser('/') : null;
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
