import 'server-only';
import { redirect } from 'next/navigation';
import { usingSupabase } from './drills/store';
import { getAppStore } from './app/store';
import type { Team } from './plans/schema';
import { editorLabel } from './plans/activity';

/** analytics: may see Admin → Analytics (Brett only; the waitlist holds personal emails, decision 0019). */
export type Admin = { id: string; email: string; local: boolean; analytics: boolean };
/** name: the first name the coach gave at sign-up, else one made from their email (decision 0013). */
export type Coach = { id: string; email: string; name: string; hasPassword: boolean; local: boolean; isAdmin: boolean; analytics: boolean };

async function currentUser(nextPath: string): Promise<Coach> {
  if (!usingSupabase()) return { id: 'local', email: 'Local coach', name: 'Coach', hasPassword: true, local: true, isAdmin: true, analytics: true };
  const { supabaseServer } = await import('./supabase/server');
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  const [{ data: isAdmin }, { data: analytics }] = await Promise.all([supabase.rpc('is_admin'), supabase.rpc('can_see_analytics')]);
  const meta = (data.user.user_metadata ?? {}) as { first_name?: string; has_password?: boolean };
  const email = data.user.email ?? 'Coach';
  // can_see_analytics errors before its migration has run: nobody sees Analytics until then.
  return { id: data.user.id, email, name: meta.first_name?.trim() || editorLabel(email), hasPassword: meta.has_password === true, local: false, isAdmin: Boolean(isAdmin), analytics: analytics === true };
}

// Every admin page and server action calls this first. RLS enforces the same rule in the database.
export async function requireAdmin(nextPath = '/admin/drills'): Promise<Admin> {
  const u = await currentUser(nextPath);
  // Coaches who aren't admins land on their plans (the sign-in email points at drill review).
  if (!u.isAdmin) redirect('/');
  return { id: u.id, email: u.email === 'Local coach' ? 'Local admin' : u.email, local: u.local, analytics: u.analytics };
}

/** Admin → Analytics and its actions. Other admins land on drill review. RLS enforces the same rule. */
export async function requireAnalytics(nextPath = '/admin/analytics'): Promise<Admin> {
  const a = await requireAdmin(nextPath);
  if (!a.analytics) redirect('/admin/drills');
  return a;
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
