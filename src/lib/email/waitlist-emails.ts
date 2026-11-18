// The lead alert to hello@firstpass.coach (decisions 0019, 0033), so Brett sees every association that
// asks about Firstpass and can reply. Sign-up is open, so coaches don't come through here any more,
// and the waitlist welcome series is retired: Brett's reply is the only answer they get.

import type { WaitlistInput } from '../site/schema';
import { SITE, esc, shell, type Email } from './layout';

export const WAITLIST_ALERT_TO = process.env.WAITLIST_ALERT_TO ?? 'hello@firstpass.coach';

export function waitlistAlertEmail(i: WaitlistInput, isNew: boolean): Email {
  const who = i.kind === 'association' ? i.orgName || i.email : `coach${i.orgName ? `, ${i.orgName}` : ''}`;
  const lead = i.kind === 'association' ? 'association lead' : 'on the waitlist';
  const subject = `${isNew ? `New ${lead}` : 'Asked again'}: ${who}`;
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
  const next = 'Email them within a day to book a call (the page promises it), then set their status on the waitlist page.';
  const html = shell({
    preheader: `${i.email} asked about Firstpass.`,
    heading: isNew ? (i.kind === 'association' ? 'New association lead' : 'New on the waitlist') : 'Asked again',
    paragraphs: [table, esc(next)],
    button: { label: 'Open Leads', url: `${SITE}/admin/leads` },
    footer: ['Sent to the Firstpass inbox for every association that asks.'],
  });
  const text = [subject, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', next, '', `Open Leads: ${SITE}/admin/leads`].join('\n');
  return { subject, html, text };
}
