import 'server-only';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { editorLabel } from './plans/activity';
import { coachJoinedEmail } from './email/account-emails';
import { SITE, sendEmail } from './email/layout';
import { TEAM_COOKIE } from './nav';
import { after } from 'next/server';
import { isNewAccount, recordSignIn, visit } from './site/visit';

// Where every successful sign-in goes next (decision 0013), whether it came from a password, a
// typed code or a tapped email link:
//   1. From a join link: join the team now (no second "Join" tap), tell the head coach, then show
//      "You're on the team".
//   2. Signed in without a password and never offered one: offer one, once.
//   3. Otherwise wherever they were going.
//
// It runs in the same request that signed in, before the browser has the new session cookie, so
// it talks to the database with the new session's token rather than through the cookie client.

/**
 * Only same-site paths: never //evil.com, https://…, or the forms a browser also reads as another site
 * (/\evil.com, a tab or newline after the slash). The path must also resolve to this site.
 */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback;
  // Backslashes and control characters: browsers treat "/\evil.com" and "/\t/evil.com" as "//evil.com".
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const u = new URL(next, 'https://firstpass.invalid');
    if (u.origin !== 'https://firstpass.invalid') return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}

/**
 * What a Google sign-in saves on the account (decision 0033): Google's first name when the account has
 * none yet (co-coaches see it, decision 0013), and that the password offer is answered, since Google
 * sign-in has no password to set. Empty when there's nothing to save.
 */
export function googleProfilePatch(meta: { first_name?: string; given_name?: string; full_name?: string; name?: string; pw_prompted?: boolean }): Record<string, string | boolean> {
  const given = (meta.given_name?.trim() || (meta.full_name ?? meta.name ?? '').trim().split(/\s+/)[0] || '').slice(0, 40);
  return { ...(!meta.first_name?.trim() && given ? { first_name: given } : {}), ...(!meta.pw_prompted ? { pw_prompted: true } : {}) };
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
  // Visit counts (decision 0051): this browser's visits today are a returning coach's, or a lead's who just made an account.
  // Read the request now; record after the response so sign-in never waits on it.
  const v = await visit().catch(() => null);
  if (v)
    after(async () => {
      await recordSignIn(user, { joinCode: opts.joinCode, visit: v });
      // Where a new account came from (decision 0052), saved once under its own session. Never throws.
      if (!v.bot && isNewAccount(user)) {
        try {
          const { error } = await asUser(session).rpc('record_account_source', { ip: v.ip, agent: v.agent, invited: Boolean(opts.joinCode && JOIN_CODE.test(opts.joinCode)) });
          // Before 20261128000000_account_sources.sql the function doesn't exist: nothing to save yet.
          if (error && error.code !== 'PGRST202') console.error('[site] account source failed: %s', error.message);
        } catch (e) {
          console.error('[site] account source failed:', e instanceof Error ? e.message : e);
        }
      }
    });

  if (opts.joinCode && JOIN_CODE.test(opts.joinCode)) {
    const code = opts.joinCode;
    const db = asUser(session);
    const { data: before } = await db.from('team_members').select('team_id').eq('user_id', user.id);
    const { data: teamId, error } = await db.rpc('join_team', { code });
    if (error) {
      // Before the 20261028 migration, join_team still refuses a coach who's on another team.
      const m = /link-off|on-another-team/.exec(error.message)?.[0] ?? 'failed';
      if (m === 'failed') console.error('[join] joining failed: %s', error.message);
      return `/join/${code}?error=${m}`;
    }
    const already = ((before ?? []) as { team_id: string }[]).some((r) => r.team_id === teamId);
    if (!already) await notifyHeadCoach(db, teamId as string, user.id);
    // The team they just joined is the one they're looking at now (decision 0026).
    await activateTeam(teamId as string);
    return `/join/${code}/joined`;
  }

  const meta = (user.user_metadata ?? {}) as { has_password?: boolean; pw_prompted?: boolean };
  if (!opts.viaPassword && !meta.has_password && !meta.pw_prompted) return `/account/password?offer=1&next=${encodeURIComponent(next)}`;
  return next;
}

/** Set the active-team cookie (decision 0026). Membership is checked again on every read. */
export async function activateTeam(teamId: string) {
  try {
    const { cookies } = await import('next/headers');
    (await cookies()).set(TEAM_COOKIE, teamId, { path: '/', maxAge: 31536000, sameSite: 'lax', httpOnly: true, secure: process.env.NODE_ENV === 'production' });
  } catch (e) {
    console.error('[join] setting the active team failed:', e instanceof Error ? e.message : e);
  }
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
    const email = coachJoinedEmail({ name: me.first_name || editorLabel(me.email), email: me.email, teamName: name, coachesUrl: `${SITE}/team/settings#coaches` });
    await sendEmail(head.email, email, 'coach-joined', `joined-${teamId}-${newCoachId}`);
  } catch (e) {
    console.error('[join] head coach email failed:', e instanceof Error ? e.message : e);
  }
}
