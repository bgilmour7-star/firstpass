import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { afterSignIn, JOIN_CODE, safeNext } from '@/lib/auth-after';

// Where a sign-in that returns with a one-time code lands: Continue with Google (decision 0033), and
// older magic links. Swap the code for a session, then continue as every sign-in does (afterSignIn):
// from a join link, join the team.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get('code');
  const next = safeNext(params.get('next'));
  const join = params.get('join');
  const joinCode = join && JOIN_CODE.test(join) ? join : null;
  const google = params.get('provider') === 'google';
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url));
  const back = (reason: string) => go(joinCode ? `/join/${joinCode}?error=google` : `/login?error=${google ? 'google' : 'link'}&reason=${encodeURIComponent(reason)}`);

  // Google sends the coach back with an error when they cancel or it refuses (?error=access_denied).
  if (!code) {
    console.error('[auth] sign-in returned without a code', request.nextUrl.search);
    return back(params.get('error') ?? 'missing_token');
  }
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('[auth] %s failed: %s %s', 'exchangeCodeForSession', error.status ?? '', error.code ?? error.message);
    return back(error.code ?? error.message);
  }

  if (google && data.user) {
    // Co-coaches see a first name (decision 0013): take Google's when the account has none yet.
    // Google sign-in has no password to offer, so don't ask to set one.
    const meta = (data.user.user_metadata ?? {}) as { first_name?: string; given_name?: string; full_name?: string; name?: string; pw_prompted?: boolean };
    const given = (meta.given_name ?? (meta.full_name ?? meta.name ?? '').split(' ')[0] ?? '').trim().slice(0, 40);
    const patch = { ...(!meta.first_name?.trim() && given ? { first_name: given } : {}), ...(!meta.pw_prompted ? { pw_prompted: true } : {}) };
    if (Object.keys(patch).length) {
      const { error: e } = await supabase.auth.updateUser({ data: patch });
      if (e) console.error('[auth] saving the Google first name failed: %s', e.message);
    }
  }
  return go(await afterSignIn(data.session, { next, joinCode, viaPassword: google }));
}
