import type { PageEvent, WaitlistEntry } from './schema';

// The numbers on Admin → Analytics, worked out from the raw rows (pilot volumes: hundreds of
// events, not millions). Days are Vancouver days, like the rest of the app.
//
// A visitor's id is a hash with a salt that changes every day, so the same person on two days
// counts twice: "unique visitors" over a period is the sum of each day's uniques, an estimate
// that runs a little high. That's the price of counting without cookies (decision 0019).

const DAY = 86_400_000;
const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' });
export const vanDay = (iso: string | Date) => ymd.format(new Date(iso));

export type Summary = {
  days: number;
  from: string;
  to: string;
  visits: Metric;
  uniques: Metric;
  /** Rows in the waitlist table: association leads since sign-up opened (decision 0033). */
  signups: Metric & { coaches: number; associations: number };
  /** Accounts created (decision 0034), from the app. Not linked to visits. */
  accounts: Metric;
  daily: { day: string; visits: number; accounts: number }[];
  peak: { day: string; visits: number } | null;
  funnel: { label: string; visitors: number }[];
  sources: { source: string; visitors: number; signups: number }[];
  devices: { label: string; share: number }[];
  regions: { label: string; share: number }[];
};
type Metric = { now: number; before: number };

/** New teams and their plans, from the app (Admin → Analytics → In the app's rows), for the funnel's last steps. */
export type FunnelApp = { teams: { id: string; createdAt: string }[]; practices: { teamId: string; createdAt: string; checkedIn: boolean }[]; accounts?: string[] };

export function summarize(events: PageEvent[], waitlist: WaitlistEntry[], opts: { days: number; now?: Date; app?: FunnelApp }): Summary {
  const now = opts.now ?? new Date();
  const end = now.getTime();
  const start = end - opts.days * DAY;
  const prevStart = start - opts.days * DAY;
  const inWin = (t: string) => {
    const ms = new Date(t).getTime();
    return ms > start && ms <= end;
  };
  const inPrev = (t: string) => {
    const ms = new Date(t).getTime();
    return ms > prevStart && ms <= start;
  };

  const cur = events.filter((e) => inWin(e.occurredAt));
  const prev = events.filter((e) => inPrev(e.occurredAt));
  const views = cur.filter((e) => e.name === 'view');
  const prevViews = prev.filter((e) => e.name === 'view');
  const joined = waitlist.filter((w) => inWin(w.createdAt));
  const joinedBefore = waitlist.filter((w) => inPrev(w.createdAt));

  const visitors = (list: PageEvent[]) => new Set(list.map((e) => e.visitor)).size;
  const uniques = visitors(views);
  const prevUniques = visitors(prevViews);

  // Every day in the period, even the quiet ones, so the chart has no gaps.
  const days: string[] = [];
  for (let t = start + DAY; t <= end + 1; t += DAY) days.push(vanDay(new Date(t)));
  const unique = [...new Set(days)];
  const allAccounts = opts.app?.accounts ?? [];
  const accounts = allAccounts.filter((t) => inWin(t));
  const daily = unique.map((day) => ({
    day,
    visits: views.filter((e) => vanDay(e.occurredAt) === day).length,
    accounts: accounts.filter((t) => vanDay(t) === day).length,
  }));
  const peak = daily.reduce<Summary['peak']>((best, d) => (d.visits > 0 && (!best || d.visits > best.visits) ? { day: d.day, visits: d.visits } : best), null);

  const reached = (name: PageEvent['name']) => visitors(cur.filter((e) => e.name === name));
  // Sign-up is open (decision 0033): from a visit to a team that has run a practice. The last three steps are counted
  // in the app, not linked to visits (no cookies), so they can include coaches who came another way.
  const newTeams = new Set((opts.app?.teams ?? []).filter((t) => inWin(t.createdAt)).map((t) => t.id));
  // Every new team gets its first plan at setup, so the step that shows real use is a practice run and checked in.
  const checkedIn = new Set((opts.app?.practices ?? []).filter((p) => newTeams.has(p.teamId) && p.checkedIn).map((p) => p.teamId));
  const funnel = [
    { label: 'Visited', visitors: uniques },
    { label: 'Tapped Plan your first practice', visitors: reached('form_start') },
    { label: 'Created an account', visitors: accounts.length },
    { label: 'Made a team', visitors: newTeams.size },
    { label: 'Checked in after a practice', visitors: checkedIn.size },
  ];

  const bySource = new Map<string, { visitors: Set<string>; signups: number }>();
  const slot = (s: string | null) => {
    const key = s ?? 'direct';
    if (!bySource.has(key)) bySource.set(key, { visitors: new Set(), signups: 0 });
    return bySource.get(key)!;
  };
  for (const e of views) slot(e.source).visitors.add(e.visitor);
  for (const w of joined) slot(w.source).signups += 1;
  const sources = [...bySource.entries()]
    .map(([source, v]) => ({ source, visitors: v.visitors.size, signups: v.signups }))
    .sort((a, b) => b.visitors - a.visitors || b.signups - a.signups);

  const coaches = joined.filter((w) => w.kind === 'coach');

  // Shares of visitors, each visitor counted once with their first view's device and place.
  const firstView = new Map<string, PageEvent>();
  for (const e of views) if (!firstView.has(e.visitor)) firstView.set(e.visitor, e);
  const people = [...firstView.values()];
  const share = (pick: (e: PageEvent) => string | null, top: number, rest: string) => {
    const counts = new Map<string, number>();
    for (const e of people) {
      const k = pick(e) ?? 'Unknown';
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const head = sorted.slice(0, top).map(([label, n]) => ({ label, share: n / (people.length || 1) }));
    const tail = sorted.slice(top).reduce((s, [, n]) => s + n, 0);
    return tail ? [...head, { label: rest, share: tail / people.length }] : head;
  };
  const DEVICE_LABEL: Record<string, string> = { phone: 'Phone', tablet: 'Tablet', desktop: 'Desktop' };

  return {
    days: opts.days,
    from: vanDay(new Date(start + DAY)),
    to: vanDay(now),
    visits: { now: views.length, before: prevViews.length },
    uniques: { now: uniques, before: prevUniques },
    signups: { now: joined.length, before: joinedBefore.length, coaches: coaches.length, associations: joined.length - coaches.length },
    accounts: { now: accounts.length, before: allAccounts.filter((t) => inPrev(t)).length },
    daily,
    peak,
    funnel,
    sources,
    devices: share((e) => (e.device ? DEVICE_LABEL[e.device] : null), 3, 'Other'),
    regions: share((e) => e.region, 4, 'Elsewhere'),
  };
}

/** "↑ 38%", "↓ 2", "No change", or null when there's nothing to compare with. */
export function change(now: number, before: number, as: 'percent' | 'count' | 'points'): string | null {
  if (as === 'count') return now === before ? 'No change' : `${now > before ? '↑' : '↓'} ${Math.abs(now - before)}`;
  if (as === 'points') {
    const d = Math.round((now - before) * 1000) / 10;
    return d === 0 ? 'No change' : `${d > 0 ? '↑' : '↓'} ${Math.abs(d)} pts`;
  }
  if (before === 0) return null;
  const pct = Math.round(((now - before) / before) * 100);
  return pct === 0 ? 'No change' : `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)}%`;
}

export type GrowthSummary = {
  teams: GrowthMetric;
  accounts: GrowthMetric;
  coaches: GrowthMetric;
  /** One row per Vancouver day in the period: the running totals at the end of that day. */
  daily: { day: string; teams: number; coaches: number }[];
};
type GrowthMetric = { total: number; inPeriod: number; before: number };

/** Teams created and coaches joined: all-time totals, the period's additions, and running totals per day. */
export function summarizeGrowth(g: { teams: string[]; coaches: string[]; accounts?: string[] }, opts: { days: number; now?: Date }): GrowthSummary {
  const end = (opts.now ?? new Date()).getTime();
  const start = end - opts.days * DAY;
  const prevStart = start - opts.days * DAY;
  const ms = (t: string) => new Date(t).getTime();
  const metric = (list: string[]): GrowthMetric => ({
    total: list.filter((t) => ms(t) <= end).length,
    inPeriod: list.filter((t) => ms(t) > start && ms(t) <= end).length,
    before: list.filter((t) => ms(t) > prevStart && ms(t) <= start).length,
  });
  const days: string[] = [];
  for (let t = start + DAY; t <= end + 1; t += DAY) days.push(vanDay(new Date(t)));
  const upTo = (list: string[], day: string) => list.filter((t) => ms(t) <= end && vanDay(t) <= day).length;
  return {
    teams: metric(g.teams),
    accounts: metric(g.accounts ?? []),
    coaches: metric(g.coaches),
    daily: [...new Set(days)].map((day) => ({ day, teams: upTo(g.teams, day), coaches: upTo(g.coaches, day) })),
  };
}
