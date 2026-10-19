import { describe, expect, it } from 'vitest';
import { coachJoinedEmail, inviteEmail } from './account-emails';
import { shell } from './layout';

describe('invite email', () => {
  const e = inviteEmail({ inviter: 'Brett', teamName: 'U7 Clippers', to: 'kara@example.com', joinUrl: 'https://firstpass.coach/join/abc12345?email=kara%40example.com' });
  it('says who invited you to which team', () => {
    expect(e.subject).toBe('Brett invited you to coach U7 Clippers');
    expect(e.html).toContain('Join U7 Clippers');
  });
  it('keeps the team name out of the button, so long names never break it', () => {
    expect(e.html).toContain('>Join the team</a>');
  });
  it('links to the join page with the address filled in, in html and text', () => {
    expect(e.html).toContain('href="https://firstpass.coach/join/abc12345?email=kara%40example.com"');
    expect(e.text).toContain('Join the team: https://firstpass.coach/join/abc12345?email=kara%40example.com');
  });
  it('says why it came', () => expect(e.text).toContain('You got this because Brett entered kara@example.com'));
});

describe('coach joined email', () => {
  const e = coachJoinedEmail({ name: 'Kara', email: 'kara@example.com', teamName: 'U7 <Clippers>', coachesUrl: 'https://firstpass.coach/team#coaches' });
  it('names the new coach and offers a way to remove them', () => {
    expect(e.subject).toBe('Kara joined U7 <Clippers>');
    expect(e.text).toContain('Remove them on the Team page');
  });
  it('escapes the team name in the html', () => expect(e.html).toContain('U7 &lt;Clippers&gt;'));
});

describe('email frame', () => {
  it('carries the logo, the code and the footer tagline', () => {
    const html = shell({ preheader: 'p', heading: 'Sign in', paragraphs: ['x'], code: '481920', footer: ['why'], site: 'https://firstpass.coach' });
    expect(html).toContain('src="https://firstpass.coach/email/firstpass-lockup.png"');
    expect(html).toContain('481920');
    expect(html).toContain('Practice plans for U7 and U9 hockey');
  });
});
