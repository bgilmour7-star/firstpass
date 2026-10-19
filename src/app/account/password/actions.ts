'use server';

import { requireUser } from '@/lib/auth';
import { safeNext } from '@/lib/auth-after';

// Set or change a password (decision 0013). has_password tells the sign-in screen to ask for it;
// pw_prompted means the one-time "Sign in faster next time?" offer has been answered.
export async function savePassword(password: string, next: string): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  await requireUser('/account/password');
  if (password.length < 8) return { ok: false, error: 'Use 8 or more characters.' };
  const { supabaseServer } = await import('@/lib/supabase/server');
  const db = await supabaseServer();
  const { error } = await db.auth.updateUser({ password, data: { has_password: true, pw_prompted: true } });
  if (error) {
    if (/same/i.test(error.message)) return { ok: false, error: 'That’s your current password. Pick a new one.' };
    if (/weak|password/i.test(error.message) && error.status === 422) return { ok: false, error: 'Pick a harder password: 8 or more characters, not a common one.' };
    console.error('[auth] updateUser failed: %s %s', error.status ?? '', error.code ?? error.message);
    return { ok: false, error: 'Couldn’t save it just now. Try again in a minute.' };
  }
  return { ok: true, to: safeNext(next) };
}

/** "Not now": don't offer again. */
export async function skipPassword(next: string): Promise<{ to: string }> {
  await requireUser('/account/password');
  const { supabaseServer } = await import('@/lib/supabase/server');
  const db = await supabaseServer();
  await db.auth.updateUser({ data: { pw_prompted: true } });
  return { to: safeNext(next) };
}
