import { NextResponse, type NextRequest } from 'next/server';
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
    callback.searchParams.set('next', request.nextUrl.pathname === '/' ? '/plans' : request.nextUrl.pathname);
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
  const { data } = await supabase.auth.getUser();
  // /api/cron/ is called by the database's timer and checks its own secret (decision 0010).
  // /join/ shows who invited you and signs you in on the spot (decision 0013); joining itself
  // needs a session. /email/ holds the logo the emails load.
  const open = ['/login', '/auth/', '/not-allowed', '/p/', '/api/cron/', '/join/', '/email/'].some((p) => request.nextUrl.pathname.startsWith(p));
  if (!data.user && !open) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = '';
    login.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/).*)'],
};
