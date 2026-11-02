// Discovery emails (decision 0027): a short letter from Brett asking for the 7-question survey.
// Waitlist sign-ups get welcome → nudge (day 3) → last ask (day 7); coaches already on Firstpass get
// first-practice (2 days after their first practice) → nudge (3 days later). The copy is Brett's,
// word for word from the "Firstpass Teams & Discovery" canvas (E1–E4). Every one carries an
// unsubscribe link that stops survey emails only.

import { esc, callout, footerLink, shell, type Email } from './layout';

export type DiscoveryInput = {
  /** Shown as "Hi Kara,". Null → "Hi there,". */
  firstName: string | null;
  /** The coach's team, for "Thanks for coaching the Nanaimo U7 Avalanche". */
  teamName: string | null;
  surveyUrl: string;
  unsubscribeUrl: string;
};

const hi = (name: string | null) => `Hi ${name?.trim() ? name.trim() : 'there'},`;
const SIGN_OFF = ['Thanks,', 'Brett'];
const signOffHtml = `${SIGN_OFF[0]}<br>${SIGN_OFF[1]}`;
const BUTTON = 'Answer 7 questions';

const WAITLIST_WHY = 'You got this because you joined the waitlist at firstpass.coach.';
const waitlistFooter = (i: DiscoveryInput) => [`${esc(WAITLIST_WHY)} ${footerLink('Unsubscribe', i.unsubscribeUrl)} and you won't get another email from us.`];
const waitlistFooterText = (i: DiscoveryInput) => [`${WAITLIST_WHY} Unsubscribe and you won't get another email from us: ${i.unsubscribeUrl}`];

const team = (i: DiscoveryInput) => i.teamName?.trim() || 'your team';
const coachWhy = (i: DiscoveryInput) => `You got this because you coach the ${team(i)} on Firstpass.`;
const coachFooter = (i: DiscoveryInput) => [`${esc(coachWhy(i))} ${footerLink('Stop survey emails', i.unsubscribeUrl)}. You'll still get practice emails.`];
const coachFooterText = (i: DiscoveryInput) => [`${coachWhy(i)} Stop survey emails: ${i.unsubscribeUrl}. You'll still get practice emails.`];

function text(subject: string, before: string[], button: string, url: string, after: string[], footer: string[]) {
  return [subject, '', ...before.flatMap((p) => [p, '']), `${button}: ${url}`, '', ...after.flatMap((p) => [p, '']), '--', ...footer].join('\n');
}

/** E1. Right after joining the waitlist. Replaces the old "You're on the list" confirmation. */
export function waitlistWelcomeEmail(i: DiscoveryInput): Email {
  const subject = 'Thanks for joining Firstpass';
  const p1 = "Thanks for joining the Firstpass waitlist. I'm Brett. I coach my son's U7 team in Nanaimo, and I built Firstpass so volunteer coaches like us can show up to practice with a plan.";
  const help = 'Help us improve';
  const p2 = "Before we open it up, I want to learn how you plan practices today and what's hard about it. Could you answer 7 quick questions? It takes about 3 minutes.";
  const a1 = "When you finish, I'll send you a $10 Tim Hortons card as a thank you.";
  const a2 = 'Rather just reply? That works too. One line on the hardest part of your last practice is really helpful.';
  const html = shell({
    preheader: '7 quick questions about your last practice, and a coffee on me.',
    title: subject,
    paragraphs: [esc(hi(null)), esc(p1), `<b>${esc(help)}</b><br>${esc(p2)}`],
    button: { label: BUTTON, url: esc(i.surveyUrl) },
    afterButton: [esc(a1), esc(a2), signOffHtml],
    footer: waitlistFooter(i),
  });
  return { subject, html, text: text(subject, [hi(null), p1, `${help}\n${p2}`], BUTTON, i.surveyUrl, [a1, a2, SIGN_OFF.join('\n')], waitlistFooterText(i)) };
}

/** E2. Day 3, only if the survey isn't done. */
export function waitlistNudgeEmail(i: DiscoveryInput): Email {
  const subject = '3 minutes on your last practice?';
  const p1 = "Getting this back to the top of your inbox. I'm asking coaches how their last practice went before we open Firstpass up.";
  const p2 = "It's 7 questions and takes about 3 minutes. You'll get a $10 Tim Hortons card when you finish.";
  const html = shell({
    preheader: 'Getting this back to the top of your inbox.',
    title: subject,
    paragraphs: [esc(hi(null)), esc(p1), esc(p2)],
    button: { label: BUTTON, url: esc(i.surveyUrl) },
    afterButton: [signOffHtml],
    footer: waitlistFooter(i),
  });
  return { subject, html, text: text(subject, [hi(null), p1, p2], BUTTON, i.surveyUrl, [SIGN_OFF.join('\n')], waitlistFooterText(i)) };
}

/** E3. Day 7, only if the survey isn't done. The last one: it leads with "just reply". */
export function waitlistLastAskEmail(i: DiscoveryInput): Email {
  const subject = 'One last ask about your last practice';
  const p1 = 'This is my last email about the survey, promise.';
  const p2 = 'If 3 minutes is too much right now, just hit reply and finish this sentence.';
  const line = 'The hardest part of my last practice was…';
  const p3 = "I read every reply. If you'd rather do the full survey, it's still here, with the $10 Tim Hortons card at the end.";
  const html = shell({
    preheader: 'Or just reply with one line.',
    title: subject,
    paragraphs: [esc(hi(null)), esc(p1), esc(p2), callout(line), esc(p3)],
    button: { label: BUTTON, url: esc(i.surveyUrl), outline: true },
    afterButton: [signOffHtml],
    footer: waitlistFooter(i),
  });
  return { subject, html, text: text(subject, [hi(null), p1, p2, `"${line}"`, p3], BUTTON, i.surveyUrl, [SIGN_OFF.join('\n')], waitlistFooterText(i)) };
}

/** E4. Two days after a coach's first practice on Firstpass (any team), unless they're an admin or answered already. */
export function coachFirstPracticeEmail(i: DiscoveryInput): Email {
  const subject = 'How did your first practice go?';
  const p1 = `Thanks for coaching the ${team(i)} with Firstpass. I'm Brett. I coach a U7 team in Nanaimo too, and I'm building Firstpass so volunteer coaches can show up to practice with a plan.`;
  const p2 = "You've had your first practice with it now. I'd love to hear how it went and what's still hard. Could you answer 7 quick questions? It takes about 3 minutes.";
  const a1 = "When you finish, I'll send you a $10 Tim Hortons card as a thank you.";
  const a2 = 'Rather just reply? That works too. One line on what worked or what got in your way is really helpful.';
  const html = shell({
    preheader: '7 quick questions, and a coffee on me.',
    title: subject,
    paragraphs: [esc(hi(i.firstName)), esc(p1), esc(p2)],
    button: { label: BUTTON, url: esc(i.surveyUrl) },
    afterButton: [esc(a1), esc(a2), signOffHtml],
    footer: coachFooter(i),
  });
  return { subject, html, text: text(subject, [hi(i.firstName), p1, p2], BUTTON, i.surveyUrl, [a1, a2, SIGN_OFF.join('\n')], coachFooterText(i)) };
}

/** Three days after first-practice, only if the survey isn't done. No day 7 for coaches. (No canvas artboard: written in the same voice as E2.) */
export function coachNudgeEmail(i: DiscoveryInput): Email {
  const subject = '3 minutes on your first practice?';
  const p1 = "Getting this back to the top of your inbox. I'd love to hear how practice with Firstpass went and what's still hard.";
  const p2 = "It's 7 questions and takes about 3 minutes. You'll get a $10 Tim Hortons card when you finish.";
  const html = shell({
    preheader: 'Getting this back to the top of your inbox.',
    title: subject,
    paragraphs: [esc(hi(i.firstName)), esc(p1), esc(p2)],
    button: { label: BUTTON, url: esc(i.surveyUrl) },
    afterButton: [signOffHtml],
    footer: coachFooter(i),
  });
  return { subject, html, text: text(subject, [hi(i.firstName), p1, p2], BUTTON, i.surveyUrl, [SIGN_OFF.join('\n')], coachFooterText(i)) };
}
