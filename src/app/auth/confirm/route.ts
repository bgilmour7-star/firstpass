import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';

// Email-link landing that works in any browser or device (e.g. a link opened inside the Gmail app).
// The Supabase email templates point here with the link's token hash (see docs/setup.md).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get('token_hash');
  const type = (params.get('type') ?? 'email') as EmailOtpType;
  const nextParam = params.get('next') ?? '/admin/drills';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/admin/drills';
  if (tokenHash) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL('/login?error=link', request.url));
}
