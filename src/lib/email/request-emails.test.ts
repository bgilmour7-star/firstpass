import { describe, expect, it } from 'vitest';
import { draftReadyEmail, outcomeEmail } from './request-emails';

describe('drill request emails', () => {
  it('names the drill and who asked in the draft-ready email', () => {
    const e = draftReadyEmail({ kind: 'new', requester: 'Kara', teamName: 'U7 Clippers', drillName: 'Tunnel Tag', description: 'Skate through a tunnel', reviewUrl: 'https://firstpass.coach/admin/drills/tunnel-tag' });
    expect(e.subject).toBe('Draft ready: Tunnel Tag, asked for by Kara');
    expect(e.html).toContain('https://firstpass.coach/admin/drills/tunnel-tag');
  });
  it('escapes what the coach wrote', () => {
    const e = draftReadyEmail({ kind: 'change', requester: 'Kara', teamName: 'U7', drillName: 'Ski Racer', description: '<script>x</script>', reviewUrl: 'https://x' });
    expect(e.html).not.toContain('<script>');
  });
  it('tells the coach the outcome, with the reason when declined', () => {
    expect(outcomeEmail({ kind: 'new', accepted: true, name: 'Kara', drillName: 'Tunnel Tag', reason: null, description: 'd', url: 'https://x' }).subject).toBe('Tunnel Tag is in the library');
    const no = outcomeEmail({ kind: 'change', accepted: false, name: 'Kara', drillName: 'Ski Racer', reason: 'Too much waiting', description: 'd', url: 'https://x' });
    expect(no.text).toContain('Too much waiting');
  });
});
