'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';

// Your account (decision 0014): the first name your co-coaches see, and your sign-in email.
// Both live in Supabase Auth: the name in user metadata, the email on the user itself.

type Result = { ok: true } | { ok: false; error: string };

export async function saveName(raw: string): Promise<Result> {
  await requireUser('/account');
  const name = raw.trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!name) return { ok: false, error: 'Add your first name. Your co-coaches see it.' };
  const { supabaseServer } = await import('@/lib/supabase/server');
  const { error } = await (await supabaseServer()).auth.updateUser({ data: { first_name: name } });
  if (error) {
    console.error('[account] name: %s', error.message);
    return { ok: false, error: 'Couldn’t save it just now. Try again in a minute.' };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Supabase emails a confirmation link to both the old and the new address; the email changes once it's confirmed. */
export async function changeEmail(raw: string): Promise<Result> {
  const coach = await requireUser('/account');
  const email = raw.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Enter an email, like you@example.com.' };
  if (email === coach.email.toLowerCase()) return { ok: false, error: 'That’s already your email.' };
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const { supabaseServer } = await import('@/lib/supabase/server');
  const { error } = await (await supabaseServer()).auth.updateUser({ email }, { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent('/account?email=changed')}` });
  if (error) {
    if (/already/i.test(error.message)) return { ok: false, error: 'Another Firstpass account uses that email.' };
    if (error.status === 429) return { ok: false, error: 'Too many emails in a short time. Try again in a minute.' };
    console.error('[account] email: %s %s', error.status ?? '', error.message);
    return { ok: false, error: 'Couldn’t start the change just now. Try again in a minute.' };
  }
  return { ok: true };
}
