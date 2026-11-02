import type { Audience, Note, Person, SendStats, SurveyResponse, Usage } from './schema';

// Sample discovery data for local mode, so the survey and admin pages can be built and screenshotted
// without a database. Adults only, made-up names and example.com addresses. No kids, ever.

export type LocalDiscovery = {
  people: Person[];
  invites: { token: string; personId: string; audience: Audience; usedAt: string | null }[];
  unsubscribeTokens: Record<string, string>;
  responses: SurveyResponse[];
  notes: Note[];
  themes: string[];
  usage: Usage[];
  sends: SendStats;
};

export function sampleData(now: Date): LocalDiscovery {
  const ago = (days: number, hours = 0) => new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000).toISOString();
  const person = (n: number, email: string, firstName: string | null, audience: Audience, days: number, userId: string | null = null): Person => ({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, code: `c-${String(100 + n).padStart(4, '0')}`, email, firstName, audience, userId, waitlistId: audience === 'waitlist' ? `w-${n}` : null, unsubscribedAt: null, createdAt: ago(days),
  });
  const people = [
    person(1, 'jordan@example.com', 'Jordan', 'waitlist', 6),
    person(2, 'mchen@example.com', null, 'waitlist', 5),
    person(3, 'sam.r@example.com', null, 'waitlist', 5),
    person(4, 'kara@example.com', 'Kara', 'coach', 20, 'u-kara'),
    person(5, 'dev@example.com', 'Dev', 'coach', 14, 'u-dev'),
    person(6, 'pat@example.com', null, 'waitlist', 2),
  ];
  const [jordan, chen, sam, kara, dev] = people;
  const base = { wantsHelp: null, extra: {}, callTimes: [] as string[], phone: null, themes: [] as string[] };
  const responses: SurveyResponse[] = [
    { ...base, id: 'r-1', personId: jordan.id, audience: 'waitlist', role: 'head', ageGroups: ['U7'], plannedHow: 'own_notes', plannedWhen: 'night_before', hardestPart: 'Keeping 14 kids busy while I set up the next station. The weaker skaters just stand around and lose interest.', wantsHelp: 'Something my two helpers can read on their phones.', wantsCall: true, callTimes: ['weekday_evenings', 'weekend_mornings'], phone: '250-555-0148', callStatus: 'to_book', giftCard: 'owed', themes: ['Kids standing around between drills', 'Weaker skaters lose interest'], createdAt: ago(5) },
    { ...base, id: 'r-2', personId: chen.id, audience: 'waitlist', role: 'assistant', ageGroups: ['U9'], plannedHow: 'other_coach', plannedWhen: 'that_day', hardestPart: 'I get the plan in a text at 5 pm and have no idea what the drills look like until we’re on the ice.', wantsCall: true, callTimes: ['weekday_lunch'], callStatus: 'booked', giftCard: 'owed', themes: ['Helpers don’t know the drills before the ice'], createdAt: ago(5, 3) },
    { ...base, id: 'r-3', personId: sam.id, audience: 'waitlist', role: 'head', ageGroups: ['U9'], plannedHow: 'hockey_canada', plannedWhen: 'that_day', hardestPart: 'The plans assume more coaches than I have. With two of us, three stations doesn’t work.', wantsCall: false, callStatus: 'none', giftCard: 'sent', themes: ['Plans need more coaches than they have'], createdAt: ago(6) },
    { ...base, id: 'r-4', personId: kara.id, audience: 'coach', role: 'head', ageGroups: ['U7', 'U9'], plannedHow: null, plannedWhen: 'night_before', hardestPart: 'Water breaks run long and the next drill starts late.', extra: { multi_team: true, changed_plan: 'a_little', missing: 'A way to see the plan on my watch.' }, wantsCall: false, callStatus: 'none', giftCard: 'owed', themes: ['Kids standing around between drills'], createdAt: ago(3) },
  ];
  const notes: Note[] = [
    { id: 'n-1', personId: jordan.id, kind: 'call', body: 'Plans on Sunday night from a Hockey Canada PDF, then rewrites it on her phone so the two helpers can read it. Biggest pain is the 2–3 minutes between stations: “that’s when I lose them.” Would pay herself if it saved the Sunday hour, but thinks the association should pay.', themes: ['Kids standing around between drills', 'Planning eats a whole evening', 'Who pays'], createdAt: ago(3, 2) },
    { id: 'n-2', personId: kara.id, kind: 'rink', body: 'Showed the stations view to the U9 coach on the next sheet. He asked if it does full ice.', themes: [], createdAt: ago(1) },
  ];
  const themes = ['Kids standing around between drills', 'Plans need more coaches than they have', 'Weaker skaters lose interest', 'Helpers don’t know the drills before the ice', 'Planning eats a whole evening', 'Who pays'];
  const usage: Usage[] = [
    { personId: kara.id, teams: [{ name: 'Nanaimo U7 Avalanche', ageGroup: 'U7', ice: 'half', role: 'head_coach', joinedAt: ago(20), skaters: 12, coaches: 3 }], practicesRun: 6, checkins: 5, swaps: 4, lastActive: ago(1) },
    { personId: dev.id, teams: [{ name: 'Nanaimo U7 Avalanche', ageGroup: 'U7', ice: 'half', role: 'coach', joinedAt: ago(14), skaters: 12, coaches: 3 }], practicesRun: 3, checkins: 1, swaps: 0, lastActive: ago(4) },
  ];
  const invites = people.map((p, i) => ({ token: i === 0 ? 'sample-waitlist' : i === 3 ? 'sample-coach' : `t${i}`, personId: p.id, audience: p.audience, usedAt: null }));
  const unsubscribeTokens = Object.fromEntries(people.map((p, i) => [p.id, i === 0 ? 'sample-waitlist' : i === 3 ? 'sample-coach' : `u${i}`]));
  const sends: SendStats = [
    { journey: 'waitlist', step: 'welcome', sent: 6, skipped: 0, queued: 0 },
    { journey: 'waitlist', step: 'nudge', sent: 2, skipped: 3, queued: 1 },
    { journey: 'waitlist', step: 'last-ask', sent: 1, skipped: 3, queued: 2 },
    { journey: 'coach', step: 'first-practice', sent: 2, skipped: 0, queued: 0 },
    { journey: 'coach', step: 'nudge', sent: 1, skipped: 1, queued: 0 },
  ];
  return { people, invites, unsubscribeTokens, responses, notes, themes, usage, sends };
}
