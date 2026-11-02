import { describe, expect, it } from 'vitest';
import { coachFirstPracticeEmail, coachNudgeEmail, waitlistLastAskEmail, waitlistNudgeEmail, waitlistWelcomeEmail } from './discovery-emails';

const waitlist = { firstName: null, teamName: null, surveyUrl: 'https://firstpass.coach/s/tok123', unsubscribeUrl: 'https://firstpass.coach/unsubscribe/un456' };
const coach = { firstName: 'Kara', teamName: 'Nanaimo U7 Avalanche', surveyUrl: 'https://firstpass.coach/s/tok123', unsubscribeUrl: 'https://firstpass.coach/unsubscribe/un456' };
const all = [waitlistWelcomeEmail(waitlist), waitlistNudgeEmail(waitlist), waitlistLastAskEmail(waitlist), coachFirstPracticeEmail(coach), coachNudgeEmail(coach)];

describe('discovery emails', () => {
  it('uses the canvas subjects', () => {
    expect(all.map((e) => e.subject)).toEqual(['Thanks for joining Firstpass', '3 minutes on your last practice?', 'One last ask about your last practice', 'How did your first practice go?', '3 minutes on your first practice?']);
  });

  it('keeps Brett’s copy word for word', () => {
    const w = waitlistWelcomeEmail(waitlist).text;
    expect(w).toContain("Thanks for joining the Firstpass waitlist. I'm Brett. I coach my son's U7 team in Nanaimo, and I built Firstpass so volunteer coaches like us can show up to practice with a plan.");
    expect(w).toContain("When you finish, I'll send you a $10 Tim Hortons card as a thank you.");
    expect(w).toContain('One line on the hardest part of your last practice is really helpful.');
    expect(waitlistLastAskEmail(waitlist).text).toContain('The hardest part of my last practice was…');
    expect(coachFirstPracticeEmail(coach).text).toContain('Thanks for coaching the Nanaimo U7 Avalanche with Firstpass.');
  });

  it('never uses an em dash', () => {
    for (const e of all) {
      expect(e.text).not.toContain('—');
      expect(e.html.replace(/U5–U9/g, '')).not.toContain('—');
    }
  });

  it('greets coaches by name and waitlist people as "there"', () => {
    expect(coachFirstPracticeEmail(coach).text).toContain('Hi Kara,');
    expect(coachFirstPracticeEmail({ ...coach, firstName: null }).text).toContain('Hi there,');
    expect(waitlistWelcomeEmail(waitlist).html).toContain('Hi there,');
  });

  it('links the survey and an unsubscribe in every email', () => {
    for (const e of all) {
      expect(e.html).toContain('href="https://firstpass.coach/s/tok123"');
      expect(e.html).toContain('href="https://firstpass.coach/unsubscribe/un456"');
      expect(e.text).toContain('https://firstpass.coach/unsubscribe/un456');
      expect(e.html).toContain('>Answer 7 questions</a>');
    }
  });

  it('tells coaches they keep practice emails', () => {
    expect(coachNudgeEmail(coach).html).toContain('Stop survey emails</a>. You&#39;ll still get practice emails.'.replace('&#39;', "'"));
    expect(waitlistNudgeEmail(waitlist).html).toContain("and you won't get another email from us.");
  });

  it('makes the last ask’s button the quiet one', () => {
    expect(waitlistLastAskEmail(waitlist).html).toContain('border:1.5px solid #7F9095');
    expect(waitlistWelcomeEmail(waitlist).html).not.toContain('border:1.5px solid #7F9095');
  });

  it('escapes the team name', () => {
    expect(coachFirstPracticeEmail({ ...coach, teamName: 'U7 <Avs>' }).html).toContain('U7 &lt;Avs&gt;');
  });
});
