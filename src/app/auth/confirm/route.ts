import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';
import { afterSignIn, JOIN_CODE, safeNext } from '@/lib/auth-after';

// Where every button in a Supabase email lands (decision 0013, templates in supabase/templates).
// It works in any browser or app (e.g. inside the Gmail app) because the link carries a plain
// token hash. The link was asked for from a specific screen, so it also carries where to go next
// and, from a join link, which team to join.
const TYPES: EmailOtpType[] = ['email', 'magiclink', 'signup', 'recovery', 'invite', 'email_change'];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get('token_hash');
  const rawType = params.get('type') ?? 'email';
  const type = (TYPES.includes(rawType as EmailOtpType) ? rawType : 'email') as EmailOtpType;
  const next = safeNext(params.get('next'));
  const join = params.get('join');
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (!tokenHash) {
    console.error('[auth] email link arrived without a token', request.nextUrl.search);
    return go('/login?error=link');
  }
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    console.error('[auth] verifyOtp failed: %s %s', error.status ?? '', error.code ?? error.message);
    return go(`/login?error=link${join && JOIN_CODE.test(join) ? `&next=${encodeURIComponent(`/join/${join}`)}` : ''}`);
  }
  // A password link always ends on the screen that sets it.
  if (type === 'recovery') return go('/account/password');
  // Confirming a new email: back to the account page (decision 0014).
  // Supabase confirms an email change from both inboxes; after the first, the new email is still pending.
  if (type === 'email_change') return go(data.user?.new_email ? '/account?email=half' : '/account?email=changed');
  return go(await afterSignIn(data.session, { next, joinCode: join }));
}
