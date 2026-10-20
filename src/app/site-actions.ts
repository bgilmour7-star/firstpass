'use server';

import { headers } from 'next/headers';
import { cleanSource, deviceOf, isBot, regionOf, waitlistInput, type EventName } from '@/lib/site/schema';
import { getSiteStore } from '@/lib/site/store';
import { sendEmail } from '@/lib/email/layout';
import { WAITLIST_ALERT_TO, waitlistAlertEmail, waitlistConfirmationEmail } from '@/lib/email/waitlist-emails';

// The landing page's two actions (decision 0019): join the waitlist, and count a visit.

export type JoinResult = { ok: true } | { ok: false; error: string; field?: 'email' | 'orgName' | 'teamCount' };

async function visit() {
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

export async function joinWaitlist(raw: { kind: string; email: string; ageGroup?: string; orgName?: string; teamCount?: string; source?: string; website?: string }): Promise<JoinResult> {
  // A hidden field people never see: bots fill it in. Pretend it worked.
  if (raw.website) return { ok: true };
  const parsed = waitlistInput.safeParse({ ...raw, teamCount: raw.teamCount || undefined, ageGroup: raw.ageGroup || undefined, orgName: raw.orgName || undefined });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return { ok: false, error: issue?.message ?? 'Check the form and try again.', field: field === 'email' || field === 'orgName' || field === 'teamCount' ? field : undefined };
  }
  const input = parsed.data;
  const store = await getSiteStore();
  let isNew: boolean;
  try {
    ({ isNew } = await store.join(input));
  } catch (e) {
    console.error('[waitlist] join failed:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'Something went wrong on our side. Try again in a minute, or email hello@firstpass.coach.' };
  }
  const v = await visit();
  await Promise.all([
    v.bot ? null : store.record({ name: 'signup', path: '/', ip: v.ip, agent: v.agent, source: input.source, device: v.device, region: v.region }),
    isNew ? sendEmail(input.email, waitlistConfirmationEmail(input), 'waitlist-confirmation') : null,
    sendEmail(WAITLIST_ALERT_TO, waitlistAlertEmail(input, isNew), 'waitlist-alert'),
  ]);
  return { ok: true };
}

const CLIENT_EVENTS: EventName[] = ['view', 'reached_form', 'form_start'];

/** Counted without cookies: see record_page_event in the migration. Never throws. */
export async function track(name: EventName, path: string, source: string | null): Promise<void> {
  if (!CLIENT_EVENTS.includes(name)) return;
  try {
    const v = await visit();
    if (v.bot) return;
    await (await getSiteStore()).record({ name, path: path.slice(0, 200), ip: v.ip, agent: v.agent, source: cleanSource(source), device: v.device, region: v.region });
  } catch (e) {
    console.error('[site] track failed:', e instanceof Error ? e.message : e);
  }
}
