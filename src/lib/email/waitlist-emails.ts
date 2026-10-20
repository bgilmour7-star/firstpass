// Waitlist emails (decision 0019): a confirmation to the person who joined, and an alert to
// hello@firstpass.coach so Brett can email them to book a call.

import type { WaitlistInput } from '../site/schema';
import { SITE, esc, shell, type Email } from './layout';

export const WAITLIST_ALERT_TO = process.env.WAITLIST_ALERT_TO ?? 'hello@firstpass.coach';

export function waitlistConfirmationEmail(i: Pick<WaitlistInput, 'kind' | 'email'>): Email {
  const subject = 'You’re on the Firstpass waitlist';
  const lead = i.kind === 'association' ? 'Thanks for joining. I’ll email you in the next few days to set up a call about a pilot for your teams.' : 'Thanks for joining. I’ll email you in the next few days to set up a quick call about your team.';
  const more = 'Firstpass plans U5–U9 practices for volunteer coaches: set up your team once, and every practice arrives planned, timed to your ice and ready on your phone at the rink.';
  const html = shell({
    preheader: 'I’ll be in touch to book a quick call.',
    heading: 'You’re on the list',
    paragraphs: [esc(lead), esc(more), '— Brett'],
    footer: [`You got this because ${esc(i.email)} joined the waitlist at firstpass.coach. Not you? Reply and we’ll take it off.`],
  });
  const text = [subject, '', lead, '', more, '', '— Brett', '', '—', `You got this because ${i.email} joined the waitlist at firstpass.coach. Not you? Reply and we’ll take it off.`].join('\n');
  return { subject, html, text };
}

export function waitlistAlertEmail(i: WaitlistInput, isNew: boolean): Email {
  const who = i.kind === 'association' ? `association${i.orgName ? `, ${i.orgName}` : ''}` : `coach${i.orgName ? `, ${i.orgName}` : ''}`;
  const subject = `${isNew ? 'New on the waitlist' : 'Joined again'}: ${who}`;
  const rows: [string, string][] = [
    ['Email', i.email],
    ['Joining as', i.kind === 'association' ? 'Association' : 'Coach'],
    ...(i.kind === 'coach' ? ([['Age group', i.ageGroup ?? 'Not given']] as [string, string][]) : []),
    [i.kind === 'association' ? 'Association' : 'Team or association', i.orgName ?? 'Not given'],
    ...(i.kind === 'association' ? ([['U5–U9 teams', String(i.teamCount ?? 'Not given')]] as [string, string][]) : []),
    ['Came from', i.source ?? 'Direct'],
  ];
  const table = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${rows
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#51646A;white-space:nowrap;vertical-align:top;">${esc(k)}</td><td style="padding:6px 0;">${esc(v)}</td></tr>`)
    .join('')}</table>`;
  const next = 'Email them to book a call, then set their status on the Analytics page. Marking them Onboarded lets them create an account.';
  const html = shell({
    preheader: `${i.email} joined the waitlist.`,
    heading: isNew ? 'New on the waitlist' : 'Joined the waitlist again',
    paragraphs: [table, esc(next)],
    button: { label: 'Open the waitlist', url: `${SITE}/admin/analytics#waitlist` },
    footer: ['Sent to the Firstpass inbox for every waitlist sign-up.'],
  });
  const text = [subject, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', next, '', `Open the waitlist: ${SITE}/admin/analytics#waitlist`].join('\n');
  return { subject, html, text };
}
