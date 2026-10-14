'use server';

import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export type SendResult = { ok: true } | { ok: false; error: string };

// Sends the sign-in email from the server without PKCE, so the link carries a plain
// token hash that /auth/confirm can verify in any browser or app. (A PKCE link only
// works in the browser that asked for it.)
export async function sendSignInLink(email: string, next: string): Promise<SendResult> {
  const address = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return { ok: false, error: 'Enter a valid email address.' };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: false, error: 'Sign-in is not configured.' };

  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/admin/drills';

  const supabase = createClient(url, key, { auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.auth.signInWithOtp({
    email: address,
    options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(safeNext)}` },
  });
  if (!error) return { ok: true };
  console.error('[auth] signInWithOtp failed: %s %s', error.status ?? '', error.code ?? error.message);
  const limited = error.status === 429 || /rate limit/i.test(error.message);
  return {
    ok: false,
    error: limited ? 'Too many sign-in emails in the last hour. Use the most recent link in your inbox, or try again later.' : `Couldn't send the link: ${error.message}`,
  };
}
