import 'server-only';
import { headers } from 'next/headers';
import { deviceOf, isBot, regionOf } from './schema';
import { getSiteStore } from './store';

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

/** An account this new is being made right now: its first sign-in (a code or link expires within the hour). */
export const NEW_ACCOUNT_MS = 60 * 60 * 1000;

/**
 * Note a sign-in on the visit counts (decision 0051), under the same daily visitor id as the browser's
 * page views: account_created for a brand-new account (a lead converting), sign_in for anyone else (a
 * returning coach). No user id or email goes into page_events. Never throws.
 */
export async function recordSignIn(user: { created_at?: string | null }, opts: { joinCode?: string | null; now?: number } = {}): Promise<void> {
  try {
    const v = await visit();
    if (v.bot) return;
    const created = user.created_at ? Date.parse(user.created_at) : NaN;
    const isNew = Number.isFinite(created) && (opts.now ?? Date.now()) - created < NEW_ACCOUNT_MS;
    const name = isNew ? 'account_created' : 'sign_in';
    // An invited coach's new account is on /join: the lead funnel leaves those out (they didn't come from the site).
    const path = isNew ? (opts.joinCode ? '/join' : '/signup') : '/login';
    await (await getSiteStore()).record({ name, path, ip: v.ip, agent: v.agent, source: null, device: v.device, region: v.region, signedIn: true });
  } catch (e) {
    console.error('[site] sign-in event failed:', e instanceof Error ? e.message : e);
  }
}
