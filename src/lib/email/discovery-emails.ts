// Discovery emails (decision 0027): a short letter from Brett asking for the 7-question survey.
// Everyone who creates an account gets welcome → nudge (day 3) (decision 0034); a coach who hasn't answered by
// their first practice gets first-practice (2 days after it) → nudge (3 days later). The waitlist series (E1–E3)
// was retired with open sign-up (decision 0033) and its templates removed. The copy is Brett's,
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

const SIGNUP_WHY = 'You got this because you created a Firstpass account.';
const signupFooter = (i: DiscoveryInput) => [`${esc(SIGNUP_WHY)} ${footerLink('Stop survey emails', i.unsubscribeUrl)}. You'll still get practice emails.`];
const signupFooterText = (i: DiscoveryInput) => [`${SIGNUP_WHY} Stop survey emails: ${i.unsubscribeUrl}. You'll still get practice emails.`];

const team = (i: DiscoveryInput) => i.teamName?.trim() || 'your team';
const coachWhy = (i: DiscoveryInput) => `You got this because you coach the ${team(i)} on Firstpass.`;
const coachFooter = (i: DiscoveryInput) => [`${esc(coachWhy(i))} ${footerLink('Stop survey emails', i.unsubscribeUrl)}. You'll still get practice emails.`];
const coachFooterText = (i: DiscoveryInput) => [`${coachWhy(i)} Stop survey emails: ${i.unsubscribeUrl}. You'll still get practice emails.`];

function text(subject: string, before: string[], button: string, url: string, after: string[], footer: string[]) {
  return [subject, '', ...before.flatMap((p) => [p, '']), `${button}: ${url}`, '', ...after.flatMap((p) => [p, '']), '--', ...footer].join('\n');
}

/** S1. An hour after someone creates an account (decision 0034), invited coaches included. The survey before they've
 * used Firstpass much: how they plan practices today and what's hard about it. Replaces the waitlist welcome (E1). */
export function signupWelcomeEmail(i: DiscoveryInput): Email {
  const subject = 'Thanks for signing up for Firstpass';
  const p1 = "Thanks for signing up for Firstpass. I'm Brett. I coach my son's U7 team in Nanaimo, and I built Firstpass so volunteer coaches like us can show up to practice with a plan.";
  const help = 'Help me make it better';
  const p2 = "I'd love to learn how you plan practices today and what's hard about it. Could you answer 7 quick questions? It takes about 3 minutes.";
  const a1 = "When you finish, I'll send you a $10 Tim Hortons card as a thank you.";
  const a2 = 'Rather just reply? That works too. One line on the hardest part of your last practice is really helpful.';
  const html = shell({
    preheader: '7 quick questions about your last practice, and a coffee on me.',
    title: subject,
    paragraphs: [esc(hi(i.firstName)), esc(p1), `<b>${esc(help)}</b><br>${esc(p2)}`],
    button: { label: BUTTON, url: esc(i.surveyUrl) },
    afterButton: [esc(a1), esc(a2), signOffHtml],
    footer: signupFooter(i),
  });
  return { subject, html, text: text(subject, [hi(i.firstName), p1, `${help}\n${p2}`], BUTTON, i.surveyUrl, [a1, a2, SIGN_OFF.join('\n')], signupFooterText(i)) };
}

/** S2. Day 3, only if the survey isn't done. The last survey email before practice: it leads with "just reply". */
export function signupNudgeEmail(i: DiscoveryInput): Email {
  const subject = '3 minutes on how you plan practices?';
  const p1 = "Getting this back to the top of your inbox. I'm asking every coach who signs up how they plan practices today.";
  const p2 = "It's 7 questions and takes about 3 minutes. You'll get a $10 Tim Hortons card when you finish. Or just reply and finish this sentence.";
  const line = 'The hardest part of my last practice was…';
  const html = shell({
    preheader: 'Getting this back to the top of your inbox.',
    title: subject,
    paragraphs: [esc(hi(i.firstName)), esc(p1), esc(p2), callout(line)],
    button: { label: BUTTON, url: esc(i.surveyUrl) },
    afterButton: [signOffHtml],
    footer: signupFooter(i),
  });
  return { subject, html, text: text(subject, [hi(i.firstName), p1, p2, `"${line}"`], BUTTON, i.surveyUrl, [SIGN_OFF.join('\n')], signupFooterText(i)) };
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
