import { REASON_LABEL, type Checkin } from './checkin';

// What coaches said about a drill at earlier practices (decision 0008), shown on the drill
// wherever a coach meets it again: the plan block and the library drawer card. Answers from
// several coaches are merged, never averaged: disagreement is "Mixed". Older feedback fades.

export type Verdict = 'hit' | 'flop' | 'split';
export type DrillFeedback = {
  hits: number;
  flops: number;
  last: { date: string; verdict: Verdict; reasons: string[]; by: string[] } | null;
  steam: { date: string; how: 'bored' | 'tired' } | null;
  /** Nothing in the last six weeks: shown faded. */
  stale: boolean;
  /** Worth a second look: it last flopped, or they lost steam from it. */
  warn: boolean;
  /** It was a Big hit last time. */
  loved: boolean;
  line: string;
};

export const STALE_DAYS = 42;

const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
const daysBetween = (a: string, b: string) => (Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 864e5;

/**
 * Feedback by drill id, from check-ins at practices before `asOf`.
 * `steamDrill` says which drill a check-in's "lost steam from" points at.
 */
export function drillFeedback(checkins: Checkin[], dates: Map<string, string>, asOf: string, steamDrill: (c: Checkin) => string | null): Map<string, DrillFeedback> {
  // One verdict per drill per practice, from every coach's marks.
  const per = new Map<string, Map<string, { kinds: Set<'hit' | 'flop'>; reasons: Set<string>; by: Set<string> }>>();
  const steam = new Map<string, DrillFeedback['steam']>();
  for (const c of checkins) {
    const date = dates.get(c.practiceId);
    if (!date || date >= asOf) continue;
    for (const m of c.marks) {
      const byPractice = per.get(m.drillId) ?? new Map();
      per.set(m.drillId, byPractice);
      const v = byPractice.get(date) ?? { kinds: new Set(), reasons: new Set(), by: new Set() };
      byPractice.set(date, v);
      v.kinds.add(m.rating);
      if (m.rating === 'flop') {
        m.reasons.forEach((r) => v.reasons.add(REASON_LABEL[r]));
        v.by.add(c.editor);
      }
    }
    if (c.steam === 'bored' || c.steam === 'tired') {
      const d = steamDrill(c);
      if (d && (!steam.get(d) || steam.get(d)!.date < date)) steam.set(d, { date, how: c.steam });
    }
  }

  const out = new Map<string, DrillFeedback>();
  for (const id of new Set([...per.keys(), ...steam.keys()])) {
    const history = [...(per.get(id) ?? new Map()).entries()].sort(([a], [b]) => a.localeCompare(b));
    const verdicts = history.map(([date, v]) => ({ date, verdict: (v.kinds.size > 1 ? 'split' : [...v.kinds][0]) as Verdict, reasons: [...v.reasons], by: [...v.by] }));
    const last = verdicts.at(-1) ?? null;
    const st = steam.get(id) ?? null;
    const latest = [last?.date, st?.date].filter(Boolean).sort().at(-1)!;
    const stale = daysBetween(latest, asOf) > STALE_DAYS;
    const hits = verdicts.filter((v) => v.verdict === 'hit').length;
    const flops = verdicts.filter((v) => v.verdict === 'flop').length;
    const steamRecent = st && (!last || st.date >= last.date);

    const parts: string[] = [];
    if (last?.verdict === 'flop') parts.push(`Flopped ${day(last.date)}${last.reasons.length ? ` · ${last.reasons.join(', ').toLowerCase()}` : ''}${last.by.length ? ` (${last.by.join(', ')})` : ''}`);
    else if (last?.verdict === 'split') parts.push(`Mixed ${day(last.date)} · one Big hit, one Flopped`);
    else if (last) parts.push(hits > 1 ? `Big hit ×${hits} · last ${day(last.date)}` : `Big hit ${day(last.date)}`);
    if (steamRecent) parts.push(`${st.how === 'bored' ? 'got bored' : 'got tired'} from here ${day(st.date)}`);
    const line = parts.join(' · ');

    out.set(id, {
      hits,
      flops,
      last,
      steam: st,
      stale,
      warn: !stale && (last?.verdict === 'flop' || !!steamRecent),
      loved: !stale && last?.verdict === 'hit' && !steamRecent,
      line: line.charAt(0).toUpperCase() + line.slice(1),
    });
  }
  return out;
}
