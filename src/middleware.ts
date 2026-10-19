import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const JOIN_COOKIE = 'fp_join';

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
    callback.searchParams.set('next', request.nextUrl.pathname === '/' ? '/admin/drills' : request.nextUrl.pathname);
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
  const open = ['/login', '/auth/', '/not-allowed', '/p/', '/api/cron/'].some((p) => request.nextUrl.pathname.startsWith(p));
  // A join link opened while signed out (decision 0011): remember it, because the sign-in email
  // doesn't always bring people back to where they started. Once signed in, go back to it.
  const path = request.nextUrl.pathname;
  const joinCode = path.match(/^\/join\/([A-Za-z0-9]{8,64})$/)?.[1];
  if (!data.user && !open) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = '';
    login.searchParams.set('next', path);
    const redirect = NextResponse.redirect(login);
    if (joinCode) redirect.cookies.set(JOIN_COOKIE, joinCode, { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 24, path: '/' });
    return redirect;
  }
  const pending = request.cookies.get(JOIN_COOKIE)?.value;
  if (data.user && pending) {
    if (joinCode) {
      response.cookies.delete(JOIN_COOKIE);
    } else if (!path.startsWith('/auth/') && !path.startsWith('/api/') && /^[A-Za-z0-9]{8,64}$/.test(pending)) {
      const back = request.nextUrl.clone();
      back.pathname = `/join/${pending}`;
      back.search = '';
      const redirect = NextResponse.redirect(back);
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      return redirect;
    }
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/).*)'],
};
