import { describe, expect, it } from 'vitest';
import { waitlistAlertEmail } from './waitlist-emails';

describe('waitlist emails', () => {
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
