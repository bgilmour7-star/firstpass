// Account emails the app sends itself through Resend (decision 0013): inviting a coach by email,
// and telling the head coach when someone joins. Sign-in codes, confirmations and password links
// are sent by Supabase from the templates that scripts/email-templates.ts writes.

import { esc, shell, type Email } from './layout';

export type InviteEmailInput = { inviter: string; teamName: string; to: string; joinUrl: string };

export function inviteEmail(i: InviteEmailInput): Email {
  const subject = `${i.inviter} invited you to coach ${i.teamName}`;
  const lead = `${i.inviter} added you as a coach. You'll plan practices together, run them rink-side and check in after.`;
  const html = shell({
    preheader: 'Plan practices together on Firstpass.',
    heading: `Join ${i.teamName}`,
    paragraphs: [esc(lead)],
    button: { label: 'Join the team', url: esc(i.joinUrl) },
    note: `The link works until ${esc(i.inviter)} turns it off. Button not working? Paste this into your browser:<br><span style="color:#0E1B1E;word-break:break-all;">${esc(i.joinUrl)}</span>`,
    footer: [`You got this because ${esc(i.inviter)} entered ${esc(i.to)} on Firstpass. Not expecting it? Ignore it and nothing happens.`],
  });
  const text = [subject, '', lead, '', `Join the team: ${i.joinUrl}`, '', `The link works until ${i.inviter} turns it off.`, '', '—', `You got this because ${i.inviter} entered ${i.to} on Firstpass. Not expecting it? Ignore it and nothing happens.`].join('\n');
  return { subject, html, text };
}

export type CoachJoinedInput = { name: string; email: string; teamName: string; coachesUrl: string };

export function coachJoinedEmail(i: CoachJoinedInput): Email {
  const subject = `${i.name} joined ${i.teamName}`;
  const lead = `${i.name} (${i.email}) joined with your team's join link. They can see and change your plans, and their check-ins sit beside yours.`;
  const safety = `Don't know ${i.name}? Remove them on the Team page, then make a new join link so the old one stops working.`;
  const html = shell({
    preheader: 'They can see and change your plans now.',
    heading: subject,
    paragraphs: [esc(lead)],
    button: { label: 'See your coaches', url: esc(i.coachesUrl) },
    note: esc(safety),
    footer: [`You get this as head coach of ${esc(i.teamName)}, once per new coach.`],
  });
  const text = [subject, '', lead, '', `See your coaches: ${i.coachesUrl}`, '', safety].join('\n');
  return { subject, html, text };
}
