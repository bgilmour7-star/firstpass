import 'server-only';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { editorLabel } from './plans/activity';
import { coachJoinedEmail } from './email/account-emails';
import { SITE, sendEmail } from './email/layout';

// Where every successful sign-in goes next (decision 0013), whether it came from a password, a
// typed code or a tapped email link:
//   1. From a join link: join the team now (no second "Join" tap), tell the head coach, then show
//      "You're on the team".
//   2. Signed in without a password and never offered one: offer one, once.
//   3. Otherwise wherever they were going.
//
// It runs in the same request that signed in, before the browser has the new session cookie, so
// it talks to the database with the new session's token rather than through the cookie client.

/** Only same-site paths: never //evil.com or https://… */
export function safeNext(next: string | null | undefined, fallback = '/plans'): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

export const JOIN_CODE = /^[A-Za-z0-9]{8,64}$/;
/** Cookie with the last email typed on the sign-in screen, for "send a fresh link to …". */
export const LAST_EMAIL = 'fp_email';

function asUser(session: Session) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
}

export async function afterSignIn(session: Session | null, opts: { next?: string | null; joinCode?: string | null; viaPassword?: boolean }): Promise<string> {
  const next = safeNext(opts.next);
  if (!session) return next;
  const user = session.user;

  if (opts.joinCode && JOIN_CODE.test(opts.joinCode)) {
    const code = opts.joinCode;
    const db = asUser(session);
    const { data: before } = await db.from('team_members').select('team_id').eq('user_id', user.id);
    const { data: teamId, error } = await db.rpc('join_team', { code });
    if (error) {
      const m = /link-off|on-another-team/.exec(error.message)?.[0] ?? 'failed';
      if (m === 'failed') console.error('[join] joining failed: %s', error.message);
      return `/join/${code}?error=${m}`;
    }
    const already = ((before ?? []) as { team_id: string }[]).some((r) => r.team_id === teamId);
    if (!already) await notifyHeadCoach(db, teamId as string, user.id);
    return `/join/${code}/joined`;
  }

  const meta = (user.user_metadata ?? {}) as { has_password?: boolean; pw_prompted?: boolean };
  if (!opts.viaPassword && !meta.has_password && !meta.pw_prompted) return `/account/password?offer=1&next=${encodeURIComponent(next)}`;
  return next;
}

/** "Kara joined U7 Clippers" to the head coach. Never blocks joining. */
export async function notifyHeadCoach(db: SupabaseClient, teamId: string, newCoachId: string) {
  try {
    const [{ data: coaches }, { data: team }] = await Promise.all([db.rpc('team_coaches', { team: teamId }), db.from('teams').select('name').eq('id', teamId).maybeSingle()]);
    type Row = { user_id: string; email: string; first_name?: string | null; role: string };
    const list = (coaches ?? []) as Row[];
    const head = list.find((c) => c.role === 'head_coach');
    const me = list.find((c) => c.user_id === newCoachId);
    const name = (team as { name: string } | null)?.name;
    if (!head || !me || !name || head.user_id === newCoachId) return;
    const email = coachJoinedEmail({ name: me.first_name || editorLabel(me.email), email: me.email, teamName: name, coachesUrl: `${SITE}/team#coaches` });
    await sendEmail(head.email, email, 'coach-joined', `joined-${teamId}-${newCoachId}`);
  } catch (e) {
    console.error('[join] head coach email failed:', e instanceof Error ? e.message : e);
  }
}
