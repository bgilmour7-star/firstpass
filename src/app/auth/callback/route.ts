import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { afterSignIn, googleProfilePatch, JOIN_CODE, safeNext } from '@/lib/auth-after';
import { logError } from '@/lib/errors';

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
  // Back to the screen they came from, still headed where they were going.
  const back = (reason: string) => go(joinCode ? `/join/${joinCode}?error=google` : `/login?error=${google ? 'google' : 'link'}&next=${encodeURIComponent(next)}&reason=${encodeURIComponent(reason)}`);

  // Google sends the coach back with an error when they cancel or it refuses (?error=access_denied).
  if (!code) {
    logError('[auth] sign-in returned without a code: error=%s params=%s', params.get('error_code') ?? params.get('error') ?? '', [...params.keys()].join(','));
    return back(params.get('error') ?? 'missing_token');
  }
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    logError('[auth] %s failed: %s %s', 'exchangeCodeForSession', error.status ?? '', error.code ?? error.message);
    return back(error.code ?? error.message);
  }

  if (google && data.user) {
    const patch = googleProfilePatch(data.user.user_metadata ?? {});
    if (Object.keys(patch).length) {
      const { error: e } = await supabase.auth.updateUser({ data: patch });
      if (e) logError('[auth] saving the Google first name failed: %s', e.message);
    }
  }
  return go(await afterSignIn(data.session, { next, joinCode, viaPassword: google }));
}
