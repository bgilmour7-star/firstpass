import { z } from 'zod';

// Emails to coaches from Admin → Send (decision 0035). The body is a list of blocks, checked here before it is saved
// or sent. No children's data: the editor says so under every text field.

export const SEGMENTS = ['all', 'head', 'age', 'stalled'] as const;
export type Segment = (typeof SEGMENTS)[number];
export const SEGMENT_LABEL: Record<Segment, string> = {
  all: 'All coaches',
  head: 'Head coaches',
  age: 'By age group',
  stalled: 'Signed up but stalled',
};
export const SEGMENT_NOTE: Record<Segment, string> = {
  all: 'Everyone with a confirmed account.',
  head: 'Coaches who run a team.',
  age: 'Coaches on a team of this age group.',
  stalled: 'Signed up 3+ days ago and never ran a practice, or nothing done in the app for 14 days.',
};
export const AGES = ['U5', 'U7', 'U9'] as const;
export type Age = (typeof AGES)[number];

const https = z
  .string()
  .trim()
  .max(500)
  .refine((u) => /^https:\/\/[^\s"<>]+$/i.test(u), 'Links must start with https://');

export const blockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().max(5000) }),
  z.object({ type: z.literal('heading'), text: z.string().trim().max(120) }),
  z.object({ type: z.literal('image'), url: z.union([https, z.literal('')]), alt: z.string().trim().max(200), link: z.union([https, z.literal('')]).default('') }),
  z.object({ type: z.literal('button'), label: z.string().trim().max(40), url: z.union([https, z.literal('')]) }),
]);
export type Block = z.output<typeof blockSchema>;

export const draftSchema = z.object({
  subject: z.string().trim().max(150),
  preheader: z.string().trim().max(200),
  greeting: z.boolean(),
  blocks: z.array(blockSchema).max(40),
  segment: z.enum(SEGMENTS),
  ageGroup: z.enum(AGES).nullable(),
});
export type Draft = z.output<typeof draftSchema>;

export type Status = 'draft' | 'sending' | 'sent';
/** ref: the short code in link tags (decision 0036); null before 20261124000000_email_attribution.sql has run. */
export type Broadcast = Draft & { id: string; ref: string | null; status: Status; recipients: number; createdAt: string; updatedAt: string; sentAt: string | null };
/** What happened after an email (decision 0036): coaches it reached, who came back from each link, and what coaches
 * who clicked and didn't click did in the 7 days after. */
export type Activity = { coaches: number; viewed: number; edited: number; checkedIn: number; scored: number; any: number };
export type Stats = { sent: number; clicked: number; links: { link: number; coaches: number }[]; groups: { clicked?: Activity; notClicked?: Activity } };
export { EMAIL_REF } from './ref';

export type Recipient = { personId: string; email: string; firstName: string | null; teamName: string | null; unsubscribeToken: string };
/** skipped: opted out after Send, so never emailed (stored as failed with OPTED_OUT). */
export type SendCounts = { queued: number; sent: number; failed: number; skipped: number };
export const OPTED_OUT = 'Stopped these emails before it went out';

export const EMPTY_DRAFT: Draft = { subject: '', preheader: '', greeting: true, blocks: [{ type: 'text', text: '' }], segment: 'all', ageGroup: null };

/** What has to be true before an email can go out. Empty list: ready. */
export function problems(d: Draft): string[] {
  const out: string[] = [];
  if (!d.subject.trim()) out.push('Add a subject.');
  if (!d.blocks.some((b) => (b.type === 'text' || b.type === 'heading') && b.text.trim())) out.push('Write something in the email.');
  if (d.segment === 'age' && !d.ageGroup) out.push('Pick an age group.');
  d.blocks.forEach((b, i) => {
    if (b.type === 'image' && !b.url) out.push(`Image ${i + 1}: upload an image or remove the block.`);
    else if (b.type === 'image' && !b.alt.trim()) out.push(`Image ${i + 1}: describe it in a few words (shown when images are off).`);
    if (b.type === 'button' && (!b.label.trim() || !b.url)) out.push(`Button ${i + 1}: add a label and a link.`);
  });
  return out;
}
