// An email to coaches from Admin → Send (decision 0035), in the Firstpass frame: "Hi Kara," then Brett's blocks of
// text, headings, images and buttons, and a footer with its own opt-out for update emails. Text supports **bold**
// and [links](https://…); everything else is escaped. With a ref, every firstpass.coach link carries
// ?from=<ref>-<n> so the app can tell which email and link brought a coach back (decision 0036).

import type { Block, Draft } from '../broadcasts/schema';
import { esc, footerLink, shell, type Email } from './layout';

export type BroadcastInput = { draft: Pick<Draft, 'subject' | 'preheader' | 'greeting' | 'blocks'>; firstName: string | null; unsubscribeUrl: string; ref?: string | null };

const INK = '#0E1B1E';
const RINK = '#0C6E8F';
const BODY = "'Lexend',Helvetica,Arial,sans-serif";
const DISPLAY = "'Bricolage Grotesque',Helvetica,Arial,sans-serif";
const WHY = 'You got this because you have a Firstpass account.';

const LINK = /\[([^\]\n]{1,120})\]\((https:\/\/[^\s)"<>]+)\)/g;
const OURS = /^https:\/\/(www\.)?firstpass\.coach([/?#]|$)/i;

/** Numbers each firstpass.coach link in reading order and adds ?from=<ref>-<n>. Other links are left alone. */
type Tagger = (url: string) => string;
function tagger(ref: string | null | undefined): Tagger {
  let n = 0;
  return (url) => {
    if (!OURS.test(url)) return url;
    n += 1;
    if (!ref) return url;
    try {
      const u = new URL(url);
      u.searchParams.set('from', `${ref}-${n}`);
      return u.toString();
    } catch {
      return url;
    }
  };
}

/** **bold** and [label](https://url), on text that is already escaped (so a URL's & arrives as &amp;). */
function inline(escaped: string, tag: Tagger): string {
  return escaped
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(LINK, (m, label: string, url: string) =>
      // A < > or " in the URL means it isn't a link in the raw text either (emailLinks wouldn't count it).
      /&(lt|gt|quot);/.test(url) ? m : `<a href="${esc(tag(url.replace(/&amp;/g, '&')))}" style="color:${RINK};">${label}</a>`,
    );
}
const inlineText = (s: string, tag: Tagger) => s.replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(LINK, (_m, label: string, url: string) => `${label} (${tag(url)})`);
const paragraphs = (text: string) =>
  text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

function blockHtml(b: Block, tag: Tagger): string[] {
  switch (b.type) {
    case 'text':
      return paragraphs(b.text).map((p) => inline(esc(p), tag).replace(/\n/g, '<br>'));
    case 'heading':
      return b.text.trim() ? [`<div style="padding-top:10px;font:800 21px/26px ${DISPLAY};color:${INK};">${esc(b.text.trim())}</div>`] : [];
    case 'image': {
      if (!b.url) return [];
      const img = `<img src="${esc(b.url)}" alt="${esc(b.alt)}" width="456" style="display:block;width:100%;max-width:456px;height:auto;border:0;border-radius:8px;">`;
      return [b.link ? `<a href="${esc(tag(b.link))}">${img}</a>` : img];
    }
    case 'button':
      return b.label.trim() && b.url
        ? [`<div style="padding:8px 0 4px;"><a href="${esc(tag(b.url))}" style="display:inline-block;background:${RINK};color:#FFFFFF;text-decoration:none;font:600 16px/1 ${BODY};padding:15px 28px;border-radius:999px;">${esc(b.label.trim())}</a></div>`]
        : [];
  }
}

function blockText(b: Block, tag: Tagger): string[] {
  switch (b.type) {
    case 'text':
      return paragraphs(b.text).map((p) => inlineText(p, tag));
    case 'heading':
      return b.text.trim() ? [b.text.trim().toUpperCase()] : [];
    case 'image':
      return b.url ? [`[Image: ${b.alt || 'picture'}]${b.link ? ` ${tag(b.link)}` : ''}`] : [];
    case 'button':
      return b.label.trim() && b.url ? [`${b.label.trim()}: ${tag(b.url)}`] : [];
  }
}

export function broadcastEmail(i: BroadcastInput): Email {
  const subject = i.draft.subject.trim() || '(No subject)';
  const hi = `Hi ${i.firstName?.trim() || 'there'},`;
  const htmlTag = tagger(i.ref);
  const textTag = tagger(i.ref);
  const body = i.draft.blocks.flatMap((b) => blockHtml(b, htmlTag));
  const html = shell({
    preheader: i.draft.preheader.trim() || subject,
    title: subject,
    paragraphs: [...(i.draft.greeting ? [esc(hi)] : []), ...body],
    footer: [`${esc(WHY)} ${footerLink('Stop update emails', i.unsubscribeUrl)}. You'll still get practice emails.`],
  });
  const text = [subject, '', ...(i.draft.greeting ? [hi, ''] : []), ...i.draft.blocks.flatMap((b) => blockText(b, textTag)).flatMap((p) => [p, '']), '--', `${WHY} Stop update emails: ${i.unsubscribeUrl}. You'll still get practice emails.`].join('\n');
  return { subject, html, text };
}

/** The firstpass.coach links in an email, numbered as the tags number them, for Admin → Send's per-link counts. */
export function emailLinks(blocks: Block[]): { n: number; label: string; url: string }[] {
  const out: { n: number; label: string; url: string }[] = [];
  const add = (label: string, url: string) => {
    if (OURS.test(url)) out.push({ n: out.length + 1, label, url });
  };
  for (const b of blocks) {
    if (b.type === 'text') for (const p of paragraphs(b.text)) for (const m of p.matchAll(LINK)) add(m[1], m[2]);
    if (b.type === 'image' && b.url && b.link) add(`Image: ${b.alt || 'picture'}`, b.link);
    if (b.type === 'button' && b.label.trim() && b.url) add(b.label.trim(), b.url);
  }
  return out;
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
