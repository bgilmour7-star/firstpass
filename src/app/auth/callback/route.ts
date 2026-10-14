import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// Magic-link landing: swap the one-time code for a session, then continue.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const nextParam = request.nextUrl.searchParams.get('next') ?? '/admin/drills';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/admin/drills';
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    console.error('[auth] %s failed: %s %s', 'exchangeCodeForSession', error.status ?? '', error.code ?? error.message);
    return NextResponse.redirect(new URL(`/login?error=link&reason=${encodeURIComponent(error.code ?? error.message)}`, request.url));
  }
  console.error('[auth] sign-in link arrived without a token', request.nextUrl.search);
  return NextResponse.redirect(new URL('/login?error=link&reason=missing_token', request.url));
}
