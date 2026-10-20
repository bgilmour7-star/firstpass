import { esc, shell, type Email } from './layout';

// Emails for drill requests (decision 0018): "Claude's draft is ready" to the reviewer, and the
// outcome to the coach who asked. Team details only, never a child's name.

const quote = (s: string) => (s.length > 220 ? `${s.slice(0, 217).trimEnd()}…` : s);

export type DraftReadyInput = { kind: 'new' | 'change'; requester: string; teamName: string; drillName: string | null; description: string; reviewUrl: string };

export function draftReadyEmail(i: DraftReadyInput): Email {
  const who = `${i.requester} (${i.teamName})`;
  const subject = i.kind === 'new' ? `Draft ready: ${i.drillName ?? 'a new drill'}, asked for by ${i.requester}` : `Change ready: ${i.drillName ?? 'a drill'}, suggested by ${i.requester}`;
  const lead = i.kind === 'new' ? `${who} asked for a drill. Claude's draft${i.drillName ? `, ${i.drillName},` : ''} is in Drill review.` : `${who} suggested a change to ${i.drillName ?? 'a drill'}. Claude's proposal is ready; the live drill stays as it is until you accept.`;
  const html = shell({
    preheader: i.kind === 'new' ? 'It’s in review. Coaches see it once you make it live.' : 'Accept or decline it in Drill review.',
    heading: i.kind === 'new' ? 'A requested drill is ready to review' : 'A suggested change is ready to review',
    paragraphs: [esc(lead), `<span style="color:#4A5C61;">They wrote: “${esc(quote(i.description))}”</span>`],
    button: { label: 'Review it', url: esc(i.reviewUrl) },
    note: esc(`${i.requester} gets an email when you decide.`),
    footer: ['You get this as the Firstpass drill reviewer, once per request.'],
  });
  const text = [subject, '', lead, '', `They wrote: “${quote(i.description)}”`, '', `Review it: ${i.reviewUrl}`].join('\n');
  return { subject, html, text };
}

export type OutcomeInput = { kind: 'new' | 'change'; accepted: boolean; name: string | null; drillName: string | null; reason: string | null; description: string; url: string };

export function outcomeEmail(i: OutcomeInput): Email {
  const hi = i.name ? `Thanks, ${i.name}. ` : 'Thanks. ';
  const subject = i.accepted
    ? i.kind === 'new'
      ? `${i.drillName ?? 'Your drill'} is in the library`
      : `${i.drillName ?? 'The drill'} is updated`
    : i.kind === 'new'
      ? 'About the drill you asked for'
      : `About your suggestion for ${i.drillName ?? 'a drill'}`;
  const lead = i.accepted
    ? i.kind === 'new'
      ? `${hi}The drill you asked for is live, so every coach can add it to a plan now.`
      : `${hi}Your suggestion is in: ${i.drillName ?? 'the drill'} has changed for every coach.`
    : `${hi}${i.kind === 'new' ? 'The drill you asked for' : 'Your suggestion'} won’t go in this time.${i.reason ? ` The reviewer said: “${i.reason}”` : ''}`;
  const html = shell({
    preheader: i.accepted ? 'Ready to add to your next plan.' : 'Ask again any time from the Drills page.',
    heading: subject,
    paragraphs: [esc(lead), `<span style="color:#4A5C61;">You wrote: “${esc(quote(i.description))}”</span>`],
    button: { label: i.accepted ? (i.kind === 'new' ? 'See the drill' : 'See what changed') : 'Go to Drills', url: esc(i.url) },
    footer: ['You get this because you sent a drill request on Firstpass.'],
  });
  const text = [subject, '', lead, '', `You wrote: “${quote(i.description)}”`, '', i.url].join('\n');
  return { subject, html, text };
}
