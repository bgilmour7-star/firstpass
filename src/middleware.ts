import { NextResponse, type NextRequest } from 'next/server';
import { EMAIL_REF } from './lib/broadcasts/ref';
import { isOpenPath } from './lib/site/public-pages';
import { createServerClient } from '@supabase/ssr';

// Keeps the Supabase session fresh and sends signed-out visitors to /login.
// Admin rights are checked again on the server for every page and action (src/lib/auth.ts),
// and by Row Level Security in the database.
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next(); // local mode, see src/lib/drills/store.ts

  // A sign-in link that lands anywhere but /auth/callback (e.g. Supabase falling back to the
  // Site URL) still carries its one-time code. Send it on to be exchanged for a session.
  const code = request.nextUrl.searchParams.get('code');
  if (code && !request.nextUrl.pathname.startsWith('/auth/')) {
    const callback = request.nextUrl.clone();
    callback.pathname = '/auth/callback';
    callback.search = '';
    callback.searchParams.set('code', code);
    callback.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(callback);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // getClaims() refreshes the session like getUser() and, with asymmetric JWT signing keys, checks the
  // token locally instead of calling Supabase Auth on every request (build plan 10.2). With the older
  // shared-secret keys it falls back to asking Supabase Auth. Pages still check the user themselves.
  // A corrupt session cookie makes getClaims() throw: treat it as signed out, as getUser() did.
  const { data } = await supabase.auth.getClaims().catch(() => ({ data: null }));
  const signedIn = Boolean(data?.claims?.sub);
  // An update email's link tag (?from=<ref>-<n>, decision 0036). Signed in: count the click here, before any page
  // redirects the request somewhere else, then carry on to the same page without the tag. Signed out: it rides
  // through sign-in in next (below), and the page keeps it in the tab (EmailClick) for open pages.
  const from = request.nextUrl.searchParams.get('from');
  const tag = from ? from.match(EMAIL_REF) : null;
  if (tag && signedIn && request.method === 'GET') {
    await supabase.rpc('record_email_click', { ref: tag[1], link: Number(tag[2]) }).then(
      ({ error }) => error && console.error('[email-click] %s', error.message),
      () => {},
    );
    const clean = request.nextUrl.clone();
    clean.searchParams.delete('from');
    const out = NextResponse.redirect(clean);
    response.cookies.getAll().forEach((c) => out.cookies.set(c));
    return out;
  }
  // Which paths are open without sign-in lives with the public site's map (src/lib/site/public-pages.ts,
  // decision 0037), so public pages, crawler files and the sitemap can't drift apart. / is the public
  // landing page (decision 0019) and sends signed-in coaches on to their plans itself.
  const path = request.nextUrl.pathname;
  if (!signedIn && !isOpenPath(path)) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = '';
    // Keep an update email's link tag (decision 0036) through sign-in, so the click is counted once they're in.
    login.searchParams.set('next', tag ? `${request.nextUrl.pathname}?from=${from}` : request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/).*)'],
};
