// An email to coaches from Admin → Send (decision 0035), in the Firstpass frame: "Hi Kara," then Brett's blocks of
// text, headings, images and buttons, and a footer with its own opt-out for update emails. Text supports **bold**
// and [links](https://…); everything else is escaped.

import type { Block, Draft } from '../broadcasts/schema';
import { esc, footerLink, shell, type Email } from './layout';

export type BroadcastInput = { draft: Pick<Draft, 'subject' | 'preheader' | 'greeting' | 'blocks'>; firstName: string | null; unsubscribeUrl: string };

const INK = '#0E1B1E';
const RINK = '#0C6E8F';
const BODY = "'Lexend',Helvetica,Arial,sans-serif";
const DISPLAY = "'Bricolage Grotesque',Helvetica,Arial,sans-serif";
const WHY = 'You got this because you have a Firstpass account.';

/** **bold** and [label](https://url), on text that is already escaped. */
function inline(escaped: string): string {
  return escaped
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]\n]{1,120})\]\((https:\/\/[^\s)"<>]+)\)/g, `<a href="$2" style="color:${RINK};">$1</a>`);
}
const inlineText = (s: string) => s.replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/\[([^\]\n]{1,120})\]\((https:\/\/[^\s)"<>]+)\)/g, '$1 ($2)');
const paragraphs = (text: string) =>
  text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

function blockHtml(b: Block): string[] {
  switch (b.type) {
    case 'text':
      return paragraphs(b.text).map((p) => inline(esc(p)).replace(/\n/g, '<br>'));
    case 'heading':
      return b.text.trim() ? [`<div style="padding-top:10px;font:800 21px/26px ${DISPLAY};color:${INK};">${esc(b.text.trim())}</div>`] : [];
    case 'image': {
      if (!b.url) return [];
      const img = `<img src="${esc(b.url)}" alt="${esc(b.alt)}" width="456" style="display:block;width:100%;max-width:456px;height:auto;border:0;border-radius:8px;">`;
      return [b.link ? `<a href="${esc(b.link)}">${img}</a>` : img];
    }
    case 'button':
      return b.label.trim() && b.url
        ? [`<div style="padding:8px 0 4px;"><a href="${esc(b.url)}" style="display:inline-block;background:${RINK};color:#FFFFFF;text-decoration:none;font:600 16px/1 ${BODY};padding:15px 28px;border-radius:999px;">${esc(b.label.trim())}</a></div>`]
        : [];
  }
}

function blockText(b: Block): string[] {
  switch (b.type) {
    case 'text':
      return paragraphs(b.text).map(inlineText);
    case 'heading':
      return b.text.trim() ? [b.text.trim().toUpperCase()] : [];
    case 'image':
      return b.url ? [`[Image: ${b.alt || 'picture'}]${b.link ? ` ${b.link}` : ''}`] : [];
    case 'button':
      return b.label.trim() && b.url ? [`${b.label.trim()}: ${b.url}`] : [];
  }
}

export function broadcastEmail(i: BroadcastInput): Email {
  const subject = i.draft.subject.trim() || '(No subject)';
  const hi = `Hi ${i.firstName?.trim() || 'there'},`;
  const body = i.draft.blocks.flatMap(blockHtml);
  const html = shell({
    preheader: i.draft.preheader.trim() || subject,
    title: subject,
    paragraphs: [...(i.draft.greeting ? [esc(hi)] : []), ...body],
    footer: [`${esc(WHY)} ${footerLink('Stop update emails', i.unsubscribeUrl)}. You'll still get practice emails.`],
  });
  const text = [subject, '', ...(i.draft.greeting ? [hi, ''] : []), ...i.draft.blocks.flatMap(blockText).flatMap((p) => [p, '']), '--', `${WHY} Stop update emails: ${i.unsubscribeUrl}. You'll still get practice emails.`].join('\n');
  return { subject, html, text };
}

export const BROADCAST_SAMPLE: BroadcastInput = {
  firstName: 'Kara',
  unsubscribeUrl: 'https://firstpass.coach/unsubscribe/sample/updates',
  draft: {
    subject: 'Firstpass is open, and you can see your team get better',
    preheader: 'Progress tracking, and your co-coaches can join now.',
    greeting: true,
    blocks: [
      { type: 'text', text: "Thanks for being one of the first coaches on Firstpass. Here's what changed in the last few weeks." },
      { type: 'heading', text: 'See them get better' },
      { type: 'text', text: 'Once a month, each coach records how many kids sit at each level for each skill. **Counts only, never names.**' },
      { type: 'button', label: 'Plan your next practice', url: 'https://firstpass.coach/plans' },
      { type: 'text', text: 'Thanks,\nBrett' },
    ],
  },
};
