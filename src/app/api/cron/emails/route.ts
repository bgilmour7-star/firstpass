import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FROM_BRETT, SITE, sendEmail } from '@/lib/email/layout';
import { idempotencyKey, queuedEntry } from '@/lib/email/journeys';

// The discovery email journeys (decision 0027), called every 10 minutes by the database's timer
// (pg_cron, see the discovery migration), the same way as the check-in emails (decision 0010): the
// timer's secret travels as a bearer token and is checked by the database, so this route holds no
// secret and never sees a service key.
//
// 1. enqueue_discovery_emails adds the coach steps that are now due.
// 2. claim_due_emails claims up to 50 due emails in one step, with what each condition needs.
// 3. Each is rendered through the registry (src/lib/email/journeys.ts). Its condition is checked
//    now, at send time, so a survey finished after queueing skips the rest.
// 4. Sent through Resend with the key `${journey}-${step}-${person_id}`, then marked sent; a failed
//    send is released for the next run.

export const dynamic = 'force-dynamic';

type Due = {
  send_id: string; journey: string; step: string; person_id: string; email: string; first_name: string | null; audience: 'waitlist' | 'coach';
  unsubscribe_token: string; survey_token: string | null; survey_done: boolean; unsubscribed: boolean; is_admin: boolean; team_name: string | null;
};

export async function POST(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!secret) return NextResponse.json({ error: 'not allowed' }, { status: 401 });
  // Without a way to send, claim nothing: the emails stay due until the key is set.
  if (!url || !anonKey || !process.env.RESEND_API_KEY) return NextResponse.json({ error: 'email is not configured' }, { status: 503 });

  const db = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const denied = (m: string) => /not allowed/i.test(m);

  const queued = await db.rpc('enqueue_discovery_emails', { secret });
  if (queued.error) {
    if (denied(queued.error.message)) return NextResponse.json({ error: 'not allowed' }, { status: 401 });
    // Before the discovery SQL has run there's nothing to send.
    if (/does not exist|schema cache|could not find/i.test(queued.error.message)) return NextResponse.json({ sent: 0, skipped: 0, failed: 0, setup: 'discovery migration not run' });
    console.error('[journey-email] enqueue failed: %s', queued.error.message);
  }

  const { data, error } = await db.rpc('claim_due_emails', { secret });
  if (error) {
    if (!denied(error.message)) console.error('[journey-email] claiming failed: %s', error.message);
    return NextResponse.json({ error: denied(error.message) ? 'not allowed' : 'claim failed' }, { status: denied(error.message) ? 401 : 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const finish = (send: string, outcome: 'sent' | 'skipped' | 'released', reason?: string) => db.rpc('finish_email', { secret, send, outcome, reason: reason ?? null });

  for (const d of (data ?? []) as Due[]) {
    const entry = queuedEntry(d.journey, d.step);
    const why = !entry ? 'not-registered' : !d.survey_token ? 'no-survey-link' : entry.skip({ surveyDone: d.survey_done, unsubscribed: d.unsubscribed, isAdmin: d.is_admin, audience: d.audience });
    if (why || !entry || !d.survey_token) {
      skipped++;
      await finish(d.send_id, 'skipped', why ?? 'skipped');
      continue;
    }
    const unsubscribeUrl = `${SITE}/unsubscribe/${d.unsubscribe_token}`;
    const email = entry.render({ firstName: d.first_name, teamName: d.team_name, surveyUrl: `${SITE}/s/${d.survey_token}`, unsubscribeUrl });
    const ok = await sendEmail(d.email, email, entry.tag ?? d.journey, {
      idempotencyKey: idempotencyKey(d.journey, d.step, d.person_id),
      from: FROM_BRETT,
      // One-click unsubscribe for mail apps that show it (CASL: unsubscribe in every discovery email).
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
    });
    if (ok) {
      sent++;
      await finish(d.send_id, 'sent');
    } else {
      failed++;
      await finish(d.send_id, 'released');
    }
  }
  return NextResponse.json({ queued: queued.data ?? 0, sent, skipped, failed });
}
