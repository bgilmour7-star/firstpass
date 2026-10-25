import { z } from 'zod';

// Discovery (decision 0027): one person across waitlist and account, the 7-question survey,
// Brett's notes and themes. No children's data: every free-text field says "No kids' names, please."

export const AUDIENCES = ['waitlist', 'coach'] as const;
export type Audience = (typeof AUDIENCES)[number];
/** Older: a coach of U11 or older who answered the short discovery screen (older_team_interest, from PR 2). */
export type ResponseAudience = Audience | 'older';

export const CALL_STATUSES = ['none', 'to_book', 'booked', 'done'] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];
export const GIFT_CARDS = ['owed', 'sent', 'not_offered'] as const;
export type GiftCard = (typeof GIFT_CARDS)[number];
export const NOTE_KINDS = ['call', 'rink', 'email', 'other'] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];
export const NOTE_KIND_LABEL: Record<NoteKind, string> = { call: 'Call', rink: 'At the rink', email: 'Email', other: 'Other' };

export const NO_KIDS = 'No kids’ names, please.';

export type Option = { value: string; label: string; short?: string };

export const ROLES: Option[] = [
  { value: 'head', label: 'Head coach', short: 'Head coach' },
  { value: 'assistant', label: 'Assistant coach', short: 'Assistant' },
  { value: 'helper', label: 'Parent helper on the ice', short: 'Helper' },
  { value: 'association', label: 'I run an association or program', short: 'Association' },
];
export const AGES: Option[] = [
  { value: 'U5', label: 'U5' },
  { value: 'U7', label: 'U7' },
  { value: 'U9', label: 'U9' },
  { value: 'U11+', label: 'U11 or older' },
];
export const PLANNED_HOW: Option[] = [
  { value: 'hockey_canada', label: 'A Hockey Canada plan or drill sheet', short: 'A Hockey Canada plan' },
  { value: 'own_notes', label: 'My own notes, on paper or my phone', short: 'Own notes' },
  { value: 'other_coach', label: 'Another coach planned it', short: 'Another coach planned it' },
  { value: 'on_ice', label: 'Made it up on the ice', short: 'Made it up on the ice' },
  { value: 'app', label: 'An app or website (which one?)', short: 'An app' },
];
/** Coaches already on Firstpass get this as Q3 instead of PLANNED_HOW. */
export const CHANGED_PLAN: Option[] = [
  { value: 'as_is', label: 'Used it as it was', short: 'Used it as is' },
  { value: 'a_little', label: 'Changed a drill or two', short: 'Changed a drill or two' },
  { value: 'a_lot', label: 'Changed most of it', short: 'Changed most of it' },
  { value: 'not_used', label: 'Didn’t use it in the end', short: 'Didn’t use it' },
];
export const PLANNED_WHEN: Option[] = [
  { value: 'earlier', label: 'Earlier in the week', short: 'Earlier in the week' },
  { value: 'night_before', label: 'The night before', short: 'The night before' },
  { value: 'that_day', label: 'That day', short: 'That day' },
  { value: 'at_rink', label: 'At the rink', short: 'At the rink' },
];
export const CALL_TIMES: Option[] = [
  { value: 'weekday_evenings', label: 'Weekday evenings' },
  { value: 'weekday_lunch', label: 'Weekday lunch' },
  { value: 'weekend_mornings', label: 'Weekend mornings' },
];

export const labelOf = (opts: Option[], v: string | null | undefined, short = true) => {
  const o = opts.find((x) => x.value === v);
  return o ? (short ? (o.short ?? o.label) : o.label) : null;
};

/** What the survey page sends. Every field is optional except the call answer: people can skip. */
export const surveyAnswers = z.object({
  role: z.enum(ROLES.map((r) => r.value) as [string, ...string[]]).nullable().default(null),
  ageGroups: z.array(z.enum(AGES.map((a) => a.value) as [string, ...string[]])).max(4).default([]),
  multiTeam: z.boolean().default(false),
  plannedHow: z.enum(PLANNED_HOW.map((a) => a.value) as [string, ...string[]]).nullable().default(null),
  plannedHowApp: z.string().trim().max(80).default(''),
  changedPlan: z.enum(CHANGED_PLAN.map((a) => a.value) as [string, ...string[]]).nullable().default(null),
  plannedWhen: z.enum(PLANNED_WHEN.map((a) => a.value) as [string, ...string[]]).nullable().default(null),
  hardestPart: z.string().trim().max(2000).default(''),
  wantsHelp: z.string().trim().max(2000).default(''),
  missing: z.string().trim().max(2000).default(''),
  wantsCall: z.boolean(),
  callTimes: z.array(z.enum(CALL_TIMES.map((a) => a.value) as [string, ...string[]])).max(3).default([]),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((p) => p === '' || /^[+()\d\s.-]{7,30}$/.test(p), 'That phone number doesn’t look right. Leave it blank to get an email instead.')
    .default(''),
});
export type SurveyAnswers = z.output<typeof surveyAnswers>;

/** The row the database stores (submit_survey's answers argument). Coaches' swapped questions go in extra. */
export function toRow(a: SurveyAnswers, audience: Audience) {
  const extra: Record<string, unknown> = {};
  if (a.multiTeam) extra.multi_team = true;
  if (a.plannedHow === 'app' && a.plannedHowApp) extra.app = a.plannedHowApp;
  if (audience === 'coach') {
    if (a.changedPlan) extra.changed_plan = a.changedPlan;
    if (a.missing) extra.missing = a.missing;
  }
  return {
    role: a.role,
    age_groups: a.ageGroups,
    planned_how: audience === 'coach' ? null : a.plannedHow,
    planned_when: a.plannedWhen,
    hardest_part: a.hardestPart || null,
    wants_help: audience === 'coach' ? null : a.wantsHelp || null,
    extra,
    wants_call: a.wantsCall,
    call_times: a.wantsCall ? a.callTimes : [],
    phone: a.wantsCall && a.phone ? a.phone : null,
  };
}

export type Person = {
  id: string;
  code: string;
  email: string;
  firstName: string | null;
  audience: Audience;
  userId: string | null;
  waitlistId: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
};

export type SurveyResponse = {
  id: string;
  personId: string;
  audience: ResponseAudience;
  role: string | null;
  ageGroups: string[];
  plannedHow: string | null;
  plannedWhen: string | null;
  hardestPart: string | null;
  wantsHelp: string | null;
  extra: { multi_team?: boolean; app?: string; changed_plan?: string; missing?: string };
  wantsCall: boolean;
  callTimes: string[];
  phone: string | null;
  callStatus: CallStatus;
  giftCard: GiftCard;
  themes: string[];
  createdAt: string;
  /** Older-team rows come from another table and can't be marked or re-tagged here. */
  readOnly?: boolean;
};

export type Note = { id: string; personId: string; kind: NoteKind; body: string; themes: string[]; createdAt: string };

export type TeamFacts = { name: string; ageGroup: string; ice: string; role: 'head_coach' | 'coach'; joinedAt: string; skaters: number; coaches: number };
export type Usage = { personId: string; teams: TeamFacts[]; practicesRun: number; checkins: number; swaps: number; lastActive: string | null };

/** Sent and started counts per outbox journey, for the Emails page. */
export type SendStats = { journey: string; step: string; sent: number; skipped: number; queued: number }[];

/** The survey link as the public page sees it: no ids. */
export type Invite = { audience: Audience; firstName: string | null; email: string; used: boolean; teamName: string | null };

/** "c-0142.md": the repo's only name for a person. */
export const CODE = /^c-\d{4,}$/;
