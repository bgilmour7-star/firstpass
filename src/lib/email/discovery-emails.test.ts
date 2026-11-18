import { describe, expect, it } from 'vitest';
import { coachFirstPracticeEmail, coachNudgeEmail, signupNudgeEmail, signupWelcomeEmail } from './discovery-emails';

const signup = { firstName: 'Kara', teamName: null, surveyUrl: 'https://firstpass.coach/s/tok123', unsubscribeUrl: 'https://firstpass.coach/unsubscribe/un456' };
const coach = { firstName: 'Kara', teamName: 'Nanaimo U7 Avalanche', surveyUrl: 'https://firstpass.coach/s/tok123', unsubscribeUrl: 'https://firstpass.coach/unsubscribe/un456' };
const all = [signupWelcomeEmail(signup), signupNudgeEmail(signup), coachFirstPracticeEmail(coach), coachNudgeEmail(coach)];

describe('discovery emails', () => {
  it('has the expected subjects', () => {
    expect(all.map((e) => e.subject)).toEqual(['Thanks for signing up for Firstpass', '3 minutes on how you plan practices?', 'How did your first practice go?', '3 minutes on your first practice?']);
  });

  it('keeps Brett’s copy word for word', () => {
    const w = signupWelcomeEmail(signup).text;
    expect(w).toContain("Thanks for signing up for Firstpass. I'm Brett. I coach my son's U7 team in Nanaimo, and I built Firstpass so volunteer coaches like us can show up to practice with a plan.");
    expect(w).toContain("When you finish, I'll send you a $10 Tim Hortons card as a thank you.");
    expect(w).toContain('One line on the hardest part of your last practice is really helpful.');
    expect(signupNudgeEmail(signup).text).toContain('The hardest part of my last practice was…');
    expect(coachFirstPracticeEmail(coach).text).toContain('Thanks for coaching the Nanaimo U7 Avalanche with Firstpass.');
  });

  it('never uses an em dash', () => {
    for (const e of all) {
      expect(e.text).not.toContain('—');
      expect(e.html.replace(/U5–U9/g, '')).not.toContain('—');
    }
  });

  it('greets people by name, or as "there"', () => {
    expect(coachFirstPracticeEmail(coach).text).toContain('Hi Kara,');
    expect(coachFirstPracticeEmail({ ...coach, firstName: null }).text).toContain('Hi there,');
    expect(signupWelcomeEmail(signup).html).toContain('Hi Kara,');
    expect(signupWelcomeEmail({ ...signup, firstName: null }).html).toContain('Hi there,');
  });

  it('links the survey and an unsubscribe in every email', () => {
    for (const e of all) {
      expect(e.html).toContain('href="https://firstpass.coach/s/tok123"');
      expect(e.html).toContain('href="https://firstpass.coach/unsubscribe/un456"');
      expect(e.text).toContain('https://firstpass.coach/unsubscribe/un456');
      expect(e.html).toContain('>Answer 7 questions</a>');
    }
  });

  it('tells everyone with an account they keep practice emails', () => {
    for (const e of all) expect(e.html).toContain("Stop survey emails</a>. You'll still get practice emails.");
    expect(signupWelcomeEmail(signup).text).toContain('You got this because you created a Firstpass account.');
  });

  it('escapes the name and team', () => {
    expect(coachFirstPracticeEmail({ ...coach, teamName: 'U7 <Avs>' }).html).toContain('U7 &lt;Avs&gt;');
    expect(signupWelcomeEmail({ ...signup, firstName: '<b>' }).html).toContain('Hi &lt;b&gt;,');
  });
});
