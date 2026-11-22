import 'server-only';
import { headers } from 'next/headers';
import { deviceOf, isBot, regionOf } from './schema';
import { getSiteStore } from './store';
import { logError } from '@/lib/errors';

/** Who's asking, from the request headers: hashed into the day's visitor id by the store (decision 0019). */
export async function visit() {
  const h = await headers();
  const agent = h.get('user-agent');
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip'),
    agent,
    device: deviceOf(agent),
    region: regionOf({ city: h.get('x-vercel-ip-city'), region: h.get('x-vercel-ip-country-region'), country: h.get('x-vercel-ip-country') }),
    bot: isBot(agent),
  };
}

/**
 * This sign-in made the account: it was created, or its email confirmed, in the last few minutes. Confirming
 * counts because a password sign-up is created when the form is sent but only signs in once confirmed.
 */
export const NEW_ACCOUNT_MS = 10 * 60 * 1000;
const JOIN_CODE = /^[A-Za-z0-9]{8,64}$/;

/** Whether the request has a signed-in Supabase session: one Auth check, no profile or role lookups. */
export async function hasSession(): Promise<boolean> {
  const { usingSupabase } = await import('@/lib/drills/store');
  // Local mode is always "signed in" as the local coach, which would make every local visit returning.
  if (!usingSupabase()) return false;
  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data } = await (await supabaseServer()).auth.getUser();
  return Boolean(data.user);
}

/** Whether this sign-in is the one that made the account (see NEW_ACCOUNT_MS). */
export function isNewAccount(user: { created_at?: string | null; email_confirmed_at?: string | null }, now = Date.now()): boolean {
  return [user.created_at, user.email_confirmed_at].some((t) => {
    const ms = t ? Date.parse(t) : NaN;
    return Number.isFinite(ms) && now - ms < NEW_ACCOUNT_MS;
  });
}

/**
 * Note a sign-in on the visit counts (decision 0051), under the same daily visitor id as the browser's
 * page views: account_created for a brand-new account (a lead converting), sign_in for anyone else (a
 * returning coach). No user id or email goes into page_events. Never throws.
 */
export async function recordSignIn(user: { created_at?: string | null; email_confirmed_at?: string | null }, opts: { joinCode?: string | null; now?: number; visit?: Awaited<ReturnType<typeof visit>> } = {}): Promise<void> {
  try {
    const v = opts.visit ?? (await visit());
    if (v.bot) return;
    const isNew = isNewAccount(user, opts.now);
    const name = isNew ? 'account_created' : 'sign_in';
    // An invited coach's new account is on /join: the lead funnel leaves those out (they didn't come from the site).
    const path = isNew ? (opts.joinCode && JOIN_CODE.test(opts.joinCode) ? '/join' : '/signup') : '/login';
    await (await getSiteStore()).record({ name, path, ip: v.ip, agent: v.agent, source: null, device: v.device, region: v.region, signedIn: true });
  } catch (e) {
    logError('[site] sign-in event failed:', e instanceof Error ? e.message : e);
  }
}
