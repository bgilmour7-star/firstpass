import { describe, expect, it } from 'vitest';
import { BROADCAST_SAMPLE, broadcastEmail } from './broadcast-email';
import type { Block } from '../broadcasts/schema';

const draft = (blocks: Block[], o: Partial<typeof BROADCAST_SAMPLE.draft> = {}) => ({ ...BROADCAST_SAMPLE.draft, blocks, ...o });
const make = (blocks: Block[], o: Partial<typeof BROADCAST_SAMPLE.draft> = {}, firstName: string | null = 'Kara') =>
  broadcastEmail({ draft: draft(blocks, o), firstName, unsubscribeUrl: 'https://firstpass.coach/unsubscribe/tok/updates' });

describe('broadcast email', () => {
  it('greets each coach by name, or there, and can leave the greeting out', () => {
    expect(make([{ type: 'text', text: 'Hello' }]).html).toContain('Hi Kara,');
    expect(make([{ type: 'text', text: 'Hello' }], {}, null).text).toContain('Hi there,');
    expect(make([{ type: 'text', text: 'Hello' }], { greeting: false }).html).not.toContain('Hi Kara,');
  });

  it('turns blank lines into paragraphs, single lines into breaks, and supports bold and https links', () => {
    const e = make([{ type: 'text', text: 'One **big** thing.\n\nSee [the plan](https://firstpass.coach/plans).\nThanks,\nBrett' }]);
    expect(e.html).toContain('One <b>big</b> thing.');
    expect(e.html).toContain('<a href="https://firstpass.coach/plans" style="color:#0C6E8F;">the plan</a>.<br>Thanks,<br>Brett');
    expect(e.text).toContain('See the plan (https://firstpass.coach/plans).');
  });

  it('escapes everything else, and only links https', () => {
    const e = make([{ type: 'text', text: '<script>x</script> [bad](javascript:alert(1)) [http](http://a.com)' }, { type: 'heading', text: '<b>Hi</b>' }]);
    expect(e.html).not.toContain('<script>');
    expect(e.html).toContain('&lt;script&gt;');
    expect(e.html).not.toContain('href="javascript');
    expect(e.html).not.toContain('href="http://');
    expect(e.html).toContain('&lt;b&gt;Hi&lt;/b&gt;');
  });

  it('draws images full width with alt text and an optional link, and buttons', () => {
    const e = make([
      { type: 'image', url: 'https://x.supabase.co/storage/v1/object/public/email-images/a.png', alt: 'The Home page', link: 'https://firstpass.coach' },
      { type: 'button', label: 'Open Firstpass', url: 'https://firstpass.coach/plans' },
    ]);
    expect(e.html).toContain('<a href="https://firstpass.coach"><img src="https://x.supabase.co/storage/v1/object/public/email-images/a.png" alt="The Home page" width="456"');
    expect(e.html).toContain('>Open Firstpass</a>');
    expect(e.text).toContain('[Image: The Home page] https://firstpass.coach');
    expect(e.text).toContain('Open Firstpass: https://firstpass.coach/plans');
  });

  it('skips empty blocks', () => {
    const e = make([{ type: 'image', url: '', alt: '', link: '' }, { type: 'button', label: '', url: '' }, { type: 'heading', text: ' ' }, { type: 'text', text: 'Only this' }]);
    expect(e.html).not.toContain('<img src=""');
    expect(e.text.split('\n').filter((l) => l.trim()).length).toBeLessThan(7);
  });

  it('carries its own opt-out, separate from practice emails', () => {
    const e = make([{ type: 'text', text: 'x' }]);
    expect(e.html).toContain('href="https://firstpass.coach/unsubscribe/tok/updates"');
    expect(e.html).toContain('Stop update emails</a>');
    expect(e.text).toContain("You'll still get practice emails.");
  });

  it('never adds an em dash of its own', () => {
    const e = broadcastEmail(BROADCAST_SAMPLE);
    expect(e.text).not.toContain('—');
    expect(e.html.replace(/U5–U9/g, '')).not.toContain('—');
  });
});
