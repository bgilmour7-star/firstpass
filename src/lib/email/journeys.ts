// Every email Firstpass sends, in one registry (decision 0027, spec D4). Admin → Emails is drawn
// from this list, the cron route (/api/cron/emails) renders queued emails through it, and a test
// fails if a template in src/lib/email/ is missing from it. Adding or changing an email means
// editing this file, so the Emails page documents itself.
//
// Two kinds of entry:
// - queued: discovery emails in the outbox (email_sends), keyed by journey + step. The database
//   queues them (enqueue_discovery_emails); the cron route checks the entry's
//   condition at send time, so a survey finished after queueing skips the rest.
// - sent elsewhere: emails the app sends from an action or route, or Supabase sends from its
//   templates. Registered so the page shows everything, with a sample to preview.

import { type Email } from './layout';
import { coachJoinedEmail, headCoachEmail, inviteEmail } from './account-emails';
import { checkinEmail } from './checkin-email';
import { coachFirstPracticeEmail, coachNudgeEmail, signupNudgeEmail, signupWelcomeEmail, type DiscoveryInput } from './discovery-emails';
import { draftReadyEmail, outcomeEmail } from './request-emails';
import { progressReminderEmail, progressReportEmail, progressScoringEmail, type ProgressReportInput } from './progress-emails';
import { SUPABASE_TEMPLATES, type SupabaseTemplate } from './supabase-templates';
import { waitlistAlertEmail } from './waitlist-emails';
import { BROADCAST_SAMPLE, broadcastEmail } from './broadcast-email';

export type Section = 'signup' | 'updates' | 'leads' | 'coach' | 'practice' | 'progress' | 'requests' | 'sign-in';

export const SECTIONS: { id: Section; title: string; note?: string }[] = [
  { id: 'signup', title: 'Creates an account', note: 'Everyone who signs up, invited coaches included (decision 0034). Accounts made before this journey started aren’t emailed.' },
  { id: 'coach', title: 'Invited to coach a team, and their first practice', note: 'Grey boxes go to someone other than the person in this journey. The first-practice email only goes to coaches who haven’t answered the survey.' },
  { id: 'practice', title: 'Every practice', note: 'One email, no reminder. A coach who skips it is asked again when they open the next practice.' },
  { id: 'progress', title: 'Every month: team progress', note: 'Starts after the first practice of the month. The report only goes to coaches who have scored.' },
  { id: 'requests', title: 'Drill requests' },
  { id: 'updates', title: 'Updates you send', note: 'Written and sent from Admin → Send, to all coaches or a segment. Their own opt-out: coaches can stop updates and keep practice emails.' },
  { id: 'leads', title: 'Association leads', note: 'From “Run an association?” on firstpass.coach. You reply yourself, and track them on the Leads tab.' },
  { id: 'sign-in', title: 'Signing in', note: 'Not a journey: each one is sent on its own when someone asks.' },
];

/** What the outbox knows about a person at send time (claim_due_emails). */
export type SendFacts = { surveyDone: boolean; unsubscribed: boolean; isAdmin: boolean; audience: 'waitlist' | 'coach' };

type Base = {
  /** `${journey}.${step}`, used in URLs (?email=) and test sends. */
  id: string;
  section: Section;
  /** Outbox key for queued emails (email_sends.journey). */
  journey: string;
  step: string;
  /** The box title on the Emails page. */
  name: string;
  /** When it goes, short: "Right away", "Day 3 · if no survey". */
  when: string;
  /** What starts it. */
  trigger: string;
  /** After the trigger, for queued emails. */
  delay?: string;
  /** Plain-word condition checked at send time, or "Always". */
  condition: string;
  /** Who gets it. person: the person in this journey. other: someone else (shown grey). */
  audience: 'person' | 'other';
  to: string;
  from: string;
  /** Where the template lives, shown on the page and checked by the registry test. */
  file: string;
  /** The exported template function, or "SUPABASE_TEMPLATES.<name>". */
  fn: string;
  /** Sent by the cron route from the outbox, by the app from an action, or by Supabase. */
  sentBy: 'outbox' | 'app' | 'cron' | 'supabase';
  /** How it's tagged in Resend, for counting. */
  tag?: string;
  /** Renders the sample, for previews and "Send me a test". */
  preview: () => Email;
};

export type QueuedEntry = Base & {
  sentBy: 'outbox';
  render: (i: DiscoveryInput) => Email;
  sample: DiscoveryInput;
  /** Null to send, or why not ("survey-done"). Checked at send time. */
  skip: (f: SendFacts) => string | null;
};
export type Entry = QueuedEntry | (Base & { sentBy: 'app' | 'cron' | 'supabase' });

const BRETT = 'Brett at Firstpass, reply-to hello@';
const FIRSTPASS = 'Firstpass <hello@firstpass.coach>';
const SITE = 'https://firstpass.coach';

const progressSample = { teamName: 'Nanaimo U7 Avalanche', month: 'November', firstName: 'Brett', settingsUrl: `${SITE}/account#emails` };
const progressReportSample: ProgressReportInput = {
  ...progressSample, url: `${SITE}/progress`, skaters: 12, coaches: ['Brett', 'Kara', 'Sam'], first: false,
  rows: [
    { attribute: 'Skating', score: 2.7, change: 0.3 }, { attribute: 'Puck control', score: 2.7, change: 0.2 }, { attribute: 'Passing', score: 1.9, change: 0.1 },
    { attribute: 'Shooting', score: 2.1, change: 0.1 }, { attribute: 'Game sense', score: 2.3, change: 0.2 }, { attribute: 'Effort & fun', score: 3.6, change: 0.2 },
  ],
  gap: { attribute: 'Shooting', coaches: [{ name: 'Brett', average: 1.7 }, { name: 'Kara', average: 2.7 }, { name: 'Sam', average: 1.9 }] },
};

const signupSample: DiscoveryInput = { firstName: 'Kara', teamName: null, surveyUrl: `${SITE}/s/sample`, unsubscribeUrl: `${SITE}/unsubscribe/sample` };
const coachSample: DiscoveryInput = { firstName: 'Kara', teamName: 'Nanaimo U7 Avalanche', surveyUrl: `${SITE}/s/sample`, unsubscribeUrl: `${SITE}/unsubscribe/sample` };

function queued(e: Omit<QueuedEntry, 'id' | 'sentBy' | 'preview' | 'tag'>): QueuedEntry {
  return { ...e, id: `${e.journey}.${e.step}`, sentBy: 'outbox', tag: `${e.journey}-${e.step}`, preview: () => e.render(e.sample) };
}

const DISCOVERY_FILE = 'src/lib/email/discovery-emails.ts';
const notUnsubscribed = (f: SendFacts) => (f.unsubscribed ? 'unsubscribed' : null);
const surveyOpen = (f: SendFacts) => notUnsubscribed(f) ?? (f.surveyDone ? 'survey-done' : null);
export const REGISTRY: Entry[] = [
  // Creates an account (decision 0034). Queued by enqueue_discovery_emails for accounts made after the journey started.
  queued({
    section: 'signup', journey: 'signup', step: 'welcome', name: 'Welcome + survey', when: '1 hour after sign-up',
    trigger: 'Creates an account (their own team or an invite)', delay: '1 hour after they confirm their email', condition: 'Not an admin, survey not done, not unsubscribed',
    audience: 'person', to: 'The person who signed up', from: BRETT, file: DISCOVERY_FILE, fn: 'signupWelcomeEmail',
    render: signupWelcomeEmail, sample: signupSample, skip: (f) => (f.isAdmin ? 'admin' : surveyOpen(f)),
  }),
  queued({
    section: 'signup', journey: 'signup', step: 'nudge', name: 'Survey nudge', when: 'Day 3 · if no survey',
    trigger: 'The welcome email went out', delay: '3 days', condition: 'Survey not done and not unsubscribed',
    audience: 'person', to: 'The person who signed up', from: BRETT, file: DISCOVERY_FILE, fn: 'signupNudgeEmail',
    render: signupNudgeEmail, sample: signupSample, skip: (f) => (f.isAdmin ? 'admin' : surveyOpen(f)),
  }),

  // Invited to coach a team
  {
    id: 'coach.invite', section: 'coach', journey: 'coach', step: 'invite', name: 'Invite to join', when: 'When invited',
    trigger: 'A head coach invites them by email from Team settings', condition: 'Always', audience: 'person', to: 'The invited coach', from: FIRSTPASS,
    file: 'src/lib/email/account-emails.ts', fn: 'inviteEmail', sentBy: 'app', tag: 'invite', preview: () => inviteEmail({ inviter: 'Brett', teamName: 'Nanaimo U7 Avalanche', to: 'kara@example.com', joinUrl: `${SITE}/join/sample` }),
  },
  {
    id: 'coach.joined', section: 'coach', journey: 'coach', step: 'joined', name: 'A coach joined', when: 'When they join',
    trigger: 'Someone joins with the team’s link', condition: 'Not the head coach themselves', audience: 'other', to: 'The head coach', from: FIRSTPASS,
    file: 'src/lib/email/account-emails.ts', fn: 'coachJoinedEmail', sentBy: 'app', tag: 'coach-joined', preview: () => coachJoinedEmail({ name: 'Kara', email: 'kara@example.com', teamName: 'Nanaimo U7 Avalanche', coachesUrl: `${SITE}/team/settings#coaches` }),
  },
  {
    id: 'coach.head-coach', section: 'coach', journey: 'coach', step: 'head-coach', name: 'You’re head coach now', when: 'When the team is handed over',
    trigger: 'The head coach hands the team to another coach', condition: 'The new head coach is already on the team', audience: 'other', to: 'The new head coach', from: FIRSTPASS,
    file: 'src/lib/email/account-emails.ts', fn: 'headCoachEmail', sentBy: 'app', tag: 'head-coach', preview: () => headCoachEmail({ from: 'Brett', teamName: 'Nanaimo U7 Avalanche', teamUrl: `${SITE}/team` }),
  },
  queued({
    section: 'coach', journey: 'coach', step: 'first-practice', name: 'How did it go? + survey', when: '2 days after 1st practice',
    trigger: 'Their first practice on any team ends', delay: '2 days', condition: 'Not an admin, survey not done, not unsubscribed',
    audience: 'person', to: 'The coach', from: BRETT, file: DISCOVERY_FILE, fn: 'coachFirstPracticeEmail',
    render: coachFirstPracticeEmail, sample: coachSample, skip: (f) => (f.isAdmin ? 'admin' : surveyOpen(f)),
  }),
  queued({
    section: 'coach', journey: 'coach', step: 'nudge', name: 'Survey nudge', when: 'Day 3 · if no survey',
    trigger: 'The first-practice email went out', delay: '3 days', condition: 'Survey not done and not unsubscribed. No day 7 for coaches.',
    audience: 'person', to: 'The coach', from: BRETT, file: DISCOVERY_FILE, fn: 'coachNudgeEmail',
    render: coachNudgeEmail, sample: coachSample, skip: (f) => (f.isAdmin ? 'admin' : surveyOpen(f)),
  }),

  // Every practice
  {
    id: 'practice.checkin', section: 'practice', journey: 'practice', step: 'checkin', name: 'After-practice check-in', when: '30 min after it ends',
    trigger: 'A planned practice ends', delay: '30 minutes', condition: 'Not checked in, email not turned off, within 6 hours', audience: 'person', to: 'Every coach on the team', from: FIRSTPASS,
    file: 'src/lib/email/checkin-email.ts', fn: 'checkinEmail', sentBy: 'cron', tag: 'checkin',
    preview: () => checkinEmail({ teamName: 'Nanaimo U7 Avalanche', practiceDate: '2026-10-28', startTime: '17:45', nextDate: '2026-10-30', checkedIn: ['Kara'], checkinUrl: `${SITE}/plans/sample/check-in`, settingsUrl: `${SITE}/account#emails` }),
  },

  // Every month: team progress (decision 0030)
  {
    id: 'progress.scoring', section: 'progress', journey: 'progress', step: 'scoring', name: 'Time for progress scoring', when: 'Morning after the month’s 1st practice',
    trigger: 'The month’s first practice ends (a round opens)', delay: 'Next morning, 9:00', condition: 'Not scored yet, progress emails on', audience: 'person', to: 'Every coach who scores', from: FIRSTPASS,
    file: 'src/lib/email/progress-emails.ts', fn: 'progressScoringEmail', sentBy: 'cron', tag: 'progress-scoring',
    preview: () => progressScoringEmail({ ...progressSample, url: `${SITE}/progress/score`, skaters: 12, previousMonth: 'October', others: ['Kara', 'Sam'] }),
  },
  {
    id: 'progress.reminder', section: 'progress', journey: 'progress', step: 'reminder', name: 'Scoring reminder', when: 'Day 2 · if not scored',
    trigger: 'Scoring email sent, or the head coach taps Send a reminder', delay: '2 days, 18:00', condition: 'Not scored yet, once per round', audience: 'person', to: 'Coaches who haven’t scored', from: FIRSTPASS,
    file: 'src/lib/email/progress-emails.ts', fn: 'progressReminderEmail', sentBy: 'cron', tag: 'progress-reminder',
    preview: () => progressReminderEmail({ ...progressSample, firstName: 'Sam', url: `${SITE}/progress/score`, done: ['Brett', 'Kara'] }),
  },
  {
    id: 'progress.report', section: 'progress', journey: 'progress', step: 'report', name: 'Monthly progress report', when: 'Day 3',
    trigger: 'Scoring email sent', delay: '3 days, 9:00', condition: 'At least one coach scored; only to coaches who scored', audience: 'person', to: 'Coaches who scored', from: FIRSTPASS,
    file: 'src/lib/email/progress-emails.ts', fn: 'progressReportEmail', sentBy: 'cron', tag: 'progress-report',
    preview: () => progressReportEmail(progressReportSample),
  },

  // Drill requests
  {
    id: 'requests.ready', section: 'requests', journey: 'requests', step: 'ready', name: 'Drill ready to review', when: 'When Claude drafts it',
    trigger: 'Claude drafts a coach’s request', condition: 'Always', audience: 'other', to: 'Admins', from: FIRSTPASS,
    file: 'src/lib/email/request-emails.ts', fn: 'draftReadyEmail', sentBy: 'cron', tag: 'drill-request-ready',
    preview: () => draftReadyEmail({ kind: 'new', requester: 'Kara', teamName: 'Nanaimo U7 Avalanche', drillName: 'Sharks and Minnows', description: 'A tag game where the weaker skaters get a head start.', reviewUrl: `${SITE}/admin/drills/sample` }),
  },
  {
    id: 'requests.outcome', section: 'requests', journey: 'requests', step: 'outcome', name: 'Your drill request', when: 'When you decide',
    trigger: 'An admin accepts or declines the request', condition: 'Always', audience: 'person', to: 'The coach who asked', from: FIRSTPASS,
    file: 'src/lib/email/request-emails.ts', fn: 'outcomeEmail', sentBy: 'app', tag: 'drill-request-outcome',
    preview: () => outcomeEmail({ kind: 'new', accepted: true, name: 'Kara', drillName: 'Sharks and Minnows', reason: null, description: 'A tag game where the weaker skaters get a head start.', url: `${SITE}/drills/sample` }),
  },

  // Updates you send (decision 0035)
  {
    id: 'updates.broadcast', section: 'updates', journey: 'updates', step: 'broadcast', name: 'An update from you', when: 'When you press Send',
    trigger: 'You send an email from Admin → Send', condition: 'Confirmed account, not an admin, updates not turned off', audience: 'person', to: 'The coaches in the segment you pick', from: BRETT,
    file: 'src/lib/email/broadcast-email.ts', fn: 'broadcastEmail', sentBy: 'app', tag: 'broadcast', preview: () => broadcastEmail(BROADCAST_SAMPLE),
  },

  // Association leads
  {
    id: 'waitlist.alert', section: 'leads', journey: 'waitlist', step: 'alert', name: 'New association lead', when: 'Right away · to you',
    trigger: 'An association asks about Firstpass (or asks again)', condition: 'Always', audience: 'other', to: 'hello@firstpass.coach (WAITLIST_ALERT_TO)', from: FIRSTPASS,
    file: 'src/lib/email/waitlist-emails.ts', fn: 'waitlistAlertEmail', sentBy: 'app', tag: 'waitlist-alert',
    preview: () => waitlistAlertEmail({ kind: 'association', email: 'coordinator@example.com', ageGroup: null, orgName: 'Nanaimo Minor Hockey', teamCount: 14, source: null }, true),
  },

  // Signing in (Supabase sends these from supabase/templates)
  ...(
    [
      ['magic-link', 'Sign-in code and link', '6-digit code + button'],
      ['confirm-signup', 'Confirm your email', 'New accounts'],
      ['reset-password', 'Set or reset password', 'From the sign-in screen'],
      ['change-email', 'Confirm a new email', 'From the account page'],
    ] as [SupabaseTemplate, string, string][]
  ).map(([key, name, to]): Entry => ({
    id: `sign-in.${key}`, section: 'sign-in', journey: 'sign-in', step: key, name, when: 'When asked for',
    trigger: 'Someone asks on the sign-in or account screen', condition: 'Always', audience: 'person', to, from: 'Firstpass, through Supabase',
    file: 'src/lib/email/supabase-templates.ts', fn: `SUPABASE_TEMPLATES.${key}`, sentBy: 'supabase',
    preview: () => ({ subject: SUPABASE_TEMPLATES[key].subject, html: SUPABASE_TEMPLATES[key].html, text: '' }),
  })),
];

export function entry(id: string): Entry | undefined {
  return REGISTRY.find((e) => e.id === id);
}

/** The outbox's emails, by journey and step. */
export function queuedEntry(journey: string, step: string): QueuedEntry | undefined {
  const e = REGISTRY.find((x) => x.journey === journey && x.step === step);
  return e?.sentBy === 'outbox' ? e : undefined;
}

/** Resend idempotency key for a queued email: the same person never gets the same step twice. */
export const idempotencyKey = (journey: string, step: string, personId: string) => `${journey}-${step}-${personId}`;
