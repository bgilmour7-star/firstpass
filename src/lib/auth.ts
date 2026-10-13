import 'server-only';
import { redirect } from 'next/navigation';
import { usingSupabase } from './drills/store';

export type Admin = { id: string; email: string; local: boolean };

// Every admin page and server action calls this first. RLS enforces the same rule in the database.
export async function requireAdmin(nextPath = '/admin/drills'): Promise<Admin> {
  if (!usingSupabase()) return { id: 'local', email: 'Local admin', local: true };
  const { supabaseServer } = await import('./supabase/server');
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/not-allowed');
  return { id: data.user.id, email: data.user.email ?? 'Admin', local: false };
}
