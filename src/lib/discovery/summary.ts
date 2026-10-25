import { CHANGED_PLAN, PLANNED_HOW, PLANNED_WHEN, ROLES, labelOf, type Note, type Person, type SurveyResponse, type Usage } from './schema';

// What Admin → Survey and Coaches show, worked out from the rows (decision 0027). Pure, so it's tested.

export const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'call', label: 'Wants a call' },
  { id: 'card', label: 'Card to send' },
  { id: 'U7', label: 'U7' },
  { id: 'U9', label: 'U9' },
  { id: 'waitlist', label: 'Waitlist' },
  { id: 'using', label: 'Using it' },
  { id: 'older', label: 'U11+' },
] as const;
export type FilterId = (typeof FILTERS)[number]['id'];

export function matches(r: SurveyResponse, f: FilterId, theme?: string | null): boolean {
  if (theme && !r.themes.includes(theme)) return false;
  switch (f) {
    case 'call':
      return r.wantsCall;
    case 'card':
      return r.giftCard === 'owed';
    case 'U7':
    case 'U9':
      return r.ageGroups.includes(f);
    case 'waitlist':
      return r.audience === 'waitlist';
    case 'using':
      return r.audience === 'coach';
    case 'older':
      return r.audience === 'older' || r.ageGroups.some((a) => /^U1[1-9]|U11\+|U15\+/.test(a));
    default:
      return true;
  }
}

export type Count = { label: string; n: number };

export function surveySummary(responses: SurveyResponse[], people: Person[], notes: Note[]) {
  const answered = new Set(responses.map((r) => r.personId));
  const wantCall = responses.filter((r) => r.wantsCall);
  const tally = (pick: (r: SurveyResponse) => string | null | undefined, order: string[]) => {
    const m = new Map<string, number>(order.map((k) => [k, 0]));
    for (const r of responses) {
      const k = pick(r);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].map(([label, n]) => ({ label, n }));
  };
  const themeCounts = new Map<string, number>();
  for (const t of [...responses.flatMap((r) => r.themes), ...notes.flatMap((n) => n.themes)]) themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
  const tagged = responses.filter((r) => r.themes.length).length + notes.filter((n) => n.themes.length).length;
  return {
    answers: responses.length,
    signups: people.length,
    wantCall: wantCall.length,
    notBooked: wantCall.filter((r) => r.callStatus === 'to_book').length,
    cardsToSend: responses.filter((r) => r.giftCard === 'owed').length,
    repliedInstead: new Set(notes.filter((n) => n.kind === 'email' && !answered.has(n.personId)).map((n) => n.personId)).size,
    filterCounts: Object.fromEntries(FILTERS.map((f) => [f.id, responses.filter((r) => matches(r, f.id)).length])) as Record<FilterId, number>,
    themes: [...themeCounts.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)),
    themedFrom: tagged,
    plannedHow: tally((r) => labelOf(PLANNED_HOW, r.plannedHow), PLANNED_HOW.map((o) => o.short ?? o.label)),
    changedPlan: tally((r) => labelOf(CHANGED_PLAN, r.extra.changed_plan), CHANGED_PLAN.map((o) => o.short ?? o.label)).filter((c) => c.n > 0),
    plannedWhen: tally((r) => labelOf(PLANNED_WHEN, r.plannedWhen), PLANNED_WHEN.map((o) => o.short ?? o.label)).filter((c) => c.n > 0),
    who: [
      { label: 'Head coaches', n: responses.filter((r) => r.role === 'head').length },
      { label: 'Assistants and helpers', n: responses.filter((r) => r.role === 'assistant' || r.role === 'helper').length },
      { label: 'Associations', n: responses.filter((r) => r.role === 'association').length },
      { label: 'Coach more than one team', n: responses.filter((r) => r.extra.multi_team).length },
    ].filter((c) => c.n > 0),
  };
}

/** "Head coach · U7 · Own notes, the night before" */
export function describe(r: SurveyResponse): string {
  const how = r.audience === 'coach' ? labelOf(CHANGED_PLAN, r.extra.changed_plan) : labelOf(PLANNED_HOW, r.plannedHow);
  const when = labelOf(PLANNED_WHEN, r.plannedWhen)?.toLowerCase();
  const plan = how && when ? `${how}, ${when}` : (how ?? (when ? `Planned ${when}` : null));
  return [labelOf(ROLES, r.role), r.ageGroups.join(', ') || null, r.audience === 'older' ? 'U11+ team' : null, plan].filter(Boolean).join(' · ');
}

/** Who a person is on screen: first name, else their email (Brett only). */
export const displayName = (p: Pick<Person, 'firstName' | 'email'>) => p.firstName?.trim() || p.email;

/** The repo file for a person (scripts/research.ts). */
export const repoPath = (p: Pick<Person, 'code'>) => `research/coaches/${p.code}.md`;

const csvCell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v);
  // Quote everything, double inner quotes, and defuse spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

export function surveyCsv(responses: SurveyResponse[], people: Person[], usage: Usage[]): string {
  const byId = new Map(people.map((p) => [p.id, p]));
  const teamOf = new Map(usage.map((u) => [u.personId, u.teams[0]?.name ?? '']));
  const head = ['date', 'code', 'first_name', 'email', 'audience', 'team', 'role', 'age_groups', 'planned_how', 'changed_plan', 'planned_when', 'hardest_part', 'wants_help', 'missing', 'wants_call', 'call_times', 'phone', 'call_status', 'gift_card', 'themes'];
  const rows = responses.map((r) => {
    const p = byId.get(r.personId);
    return [r.createdAt.slice(0, 10), p?.code, p?.firstName, p?.email, r.audience, teamOf.get(r.personId), r.role, r.ageGroups, r.plannedHow, r.extra.changed_plan, r.plannedWhen, r.hardestPart, r.wantsHelp, r.extra.missing, r.wantsCall ? 'yes' : 'no', r.callTimes, r.phone, r.callStatus, r.giftCard, r.themes];
  });
  return [head, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
