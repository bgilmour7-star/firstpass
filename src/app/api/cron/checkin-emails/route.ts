import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkinEmail } from '@/lib/email/checkin-email';

// Called every 10 minutes by the database's timer (pg_cron, see the checkin_emails migration).
// The timer's secret travels as a bearer token and is checked by the database itself, so this
// route holds no secret of its own and never sees a service key. Decision 0010.

export const dynamic = 'force-dynamic';

const SITE = process.env.SITE_URL ?? 'https://firstpass.coach';
const FROM = 'Firstpass <hello@firstpass.coach>';

type Due = { practice_id: string; user_id: string; email: string; team_name: string; practice_date: string; start_time: string; next_date: string | null; checked_in: string[] };

export async function POST(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!secret) return NextResponse.json({ error: 'not allowed' }, { status: 401 });
  // Without a way to send, claim nothing: the emails stay due until the key is set.
  if (!url || !anonKey || !resendKey) return NextResponse.json({ error: 'email is not configured' }, { status: 503 });

  const db = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc('claim_checkin_emails', { secret });
  if (error) {
    const denied = /not allowed/i.test(error.message);
    if (!denied) console.error('[checkin-email] claiming failed: %s', error.message);
    return NextResponse.json({ error: denied ? 'not allowed' : 'claim failed' }, { status: denied ? 401 : 500 });
  }

  let sent = 0;
  let failed = 0;
  for (const d of (data ?? []) as Due[]) {
    const email = checkinEmail({
      teamName: d.team_name,
      practiceDate: d.practice_date,
      startTime: d.start_time,
      nextDate: d.next_date,
      checkedIn: d.checked_in ?? [],
      checkinUrl: `${SITE}/plans/${d.practice_id}/check-in`,
      settingsUrl: `${SITE}/team#emails`,
    });
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${resendKey}`, 'content-type': 'application/json', 'idempotency-key': `checkin-${d.practice_id}-${d.user_id}` },
      body: JSON.stringify({ from: FROM, to: [d.email], subject: email.subject, html: email.html, text: email.text, tags: [{ name: 'kind', value: 'checkin' }] }),
    }).catch(() => null);
    if (res?.ok) {
      sent++;
      continue;
    }
    failed++;
    console.error('[checkin-email] sending failed: %s', res ? `${res.status} ${await res.text().catch(() => '')}` : 'network');
    // Hand it back so the next run tries again (until six hours after the practice).
    await db.rpc('release_checkin_email', { secret, practice: d.practice_id, coach: d.user_id });
  }
  return NextResponse.json({ sent, failed });
}
