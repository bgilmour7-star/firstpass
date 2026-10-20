import { describe, expect, it } from 'vitest';
import { waitlistAlertEmail, waitlistConfirmationEmail } from './waitlist-emails';

describe('waitlist emails', () => {
  it('confirms in Brett’s voice, with the call for each kind', () => {
    const coach = waitlistConfirmationEmail({ kind: 'coach', email: 'kara@example.com' });
    expect(coach.subject).toBe('You’re on the Firstpass waitlist');
    expect(coach.text).toContain('a quick call about your team');
    expect(coach.text).toContain('— Brett');
    expect(waitlistConfirmationEmail({ kind: 'association', email: 'reg@assoc.org' }).text).toContain('a pilot for your teams');
  });

  it('alerts with every field, escaped', () => {
    const e = waitlistAlertEmail({ kind: 'association', email: 'reg@assoc.org', ageGroup: null, orgName: 'A <b>&</b> B', teamCount: 14, source: 'invite' }, true);
    expect(e.subject).toBe('New on the waitlist: association, A <b>&</b> B');
    expect(e.html).toContain('A &lt;b&gt;&amp;&lt;/b&gt; B');
    expect(e.html).not.toContain('<b>&</b>');
    expect(e.text).toContain('U5–U9 teams: 14');
    expect(e.text).toContain('Came from: invite');
    expect(waitlistAlertEmail({ kind: 'coach', email: 'k@x.ca', ageGroup: 'U7', orgName: null, teamCount: null, source: null }, false).subject).toBe('Joined again: coach');
  });
});
