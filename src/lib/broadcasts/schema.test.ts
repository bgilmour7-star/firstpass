import { describe, expect, it } from 'vitest';
import { EMPTY_DRAFT, blockSchema, draftSchema, problems } from './schema';

describe('broadcast drafts', () => {
  it('asks for a subject and some words before sending', () => {
    expect(problems(EMPTY_DRAFT)).toEqual(['Add a subject.', 'Write something in the email.']);
    expect(problems({ ...EMPTY_DRAFT, subject: 'Hi', blocks: [{ type: 'text', text: 'Hello' }] })).toEqual([]);
  });

  it('needs an age group, image descriptions and complete buttons', () => {
    const d = { ...EMPTY_DRAFT, subject: 'Hi', segment: 'age' as const, ageGroup: null, blocks: [{ type: 'text' as const, text: 'x' }, { type: 'image' as const, url: 'https://a.co/i.png', alt: '', link: '' }, { type: 'button' as const, label: 'Go', url: '' }] };
    expect(problems(d)).toEqual(['Pick an age group.', 'Image 2: describe it in a few words (shown when images are off).', 'Button 3: add a label and a link.']);
  });

  it('only takes https links', () => {
    expect(blockSchema.safeParse({ type: 'button', label: 'Go', url: 'http://a.co' }).success).toBe(false);
    expect(blockSchema.safeParse({ type: 'button', label: 'Go', url: 'javascript:alert(1)' }).success).toBe(false);
    expect(blockSchema.safeParse({ type: 'image', url: 'https://a.co/x.png', alt: 'x', link: '' }).success).toBe(true);
  });

  it('refuses unknown segments and too many blocks', () => {
    expect(draftSchema.safeParse({ ...EMPTY_DRAFT, segment: 'everyone' }).success).toBe(false);
    expect(draftSchema.safeParse({ ...EMPTY_DRAFT, blocks: Array.from({ length: 41 }, () => ({ type: 'text', text: '' })) }).success).toBe(false);
  });
});

describe('an image block still being filled in', () => {
  it('saves, but asks for the image before sending', () => {
    const d = { ...EMPTY_DRAFT, subject: 'Hi', blocks: [{ type: 'text' as const, text: 'x' }, { type: 'image' as const, url: '', alt: '', link: '' }] };
    expect(draftSchema.safeParse(d).success).toBe(true);
    expect(problems(d)).toEqual(['Image 2: upload an image or remove the block.']);
  });
});
