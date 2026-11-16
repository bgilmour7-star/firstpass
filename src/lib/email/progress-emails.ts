import { esc, footerLink, shell, type Email } from './layout';
import { listNames } from './checkin-email';

// The three monthly team progress emails (decision 0030, spec → Emails): time to score, a reminder,
// and the report. Coaches' first names and counts only: there are no kids' names to include. The
// report only ever names coaches who finished scoring that month.

const INK = '#0E1B1E';
const INK2 = '#51646A';
const GOOD = '#23704A';
const WARN = '#A8461F';
const LINE = '#D7E0E2';
const GROUND = '#F3F6F7';
const BODY = "'Lexend',Helvetica,Arial,sans-serif";
const MONO = "'IBM Plex Mono','Courier New',monospace";

type Common = {
  teamName: string;
  /** "November". */
  month: string;
  /** The coach this goes to. */
  firstName: string;
  /** Scoring page, report page and Team page email settings. */
  url: string;
  settingsUrl: string;
};

export type ProgressScoringInput = Common & {
  skaters: number;
  /** "October" when this coach scored last month: the screens start from those answers. */
  previousMonth: string | null;
  /** Other coaches who score, by first name. */
  others: string[];
};

export type ProgressReminderInput = Common & {
  /** Coaches who have finished this month, by first name. */
  done: string[];
};

export type ReportRow = { attribute: string; score: number | null; change: number | null };
export type ProgressReportInput = Common & {
  skaters: number;
  /** Coaches who finished, by first name, in the order they finished. Only these are ever named. */
  coaches: string[];
  rows: ReportRow[];
  /** The skill coaches saw most differently, when they were a level or more apart. */
  gap: { attribute: string; coaches: { name: string; average: number }[] } | null;
  first: boolean;
};

const footer = (i: Common, why: string) => [esc(`You’re getting this because you coach ${i.teamName} on Firstpass. ${why}`), `${footerLink('Turn progress emails off', i.settingsUrl)} on your Team page.`];
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const signed = (n: number) => (n > 0 ? `+${n.toFixed(1)}` : n < 0 ? n.toFixed(1) : 'same');

export function progressScoringEmail(i: ProgressScoringInput): Email {
  const subject = `Time for ${i.month}’s progress scoring`;
  const heading = `Time for ${i.month}’s progress scoring, ${i.firstName}.`;
  const lead = i.previousMonth
    ? `For each skill, say how many of your ${i.skaters} skaters are at each level. It starts from your ${i.previousMonth} answers, so change only what moved. About two minutes.`
    : `For each skill, say how many of your ${i.skaters} skaters are at each level. About two minutes, once a month.`;
  const others = i.others.length
    ? `${listNames(i.others)} ${i.others.length === 1 ? 'gets' : 'get'} this too. You each score on your own, and see the others’ answers once you’ve finished yours.`
    : '';
  const ready = 'Your report is ready as soon as you finish.';
  const why = 'Once a month, plus one reminder if it’s not done.';
  const text = [heading, '', lead, '', `Start scoring: ${i.url}`, '', ...(others ? [others] : []), ready, '', '—', `You’re getting this because you coach ${i.teamName} on Firstpass. ${why}`, `Turn progress emails off on your Team page: ${i.settingsUrl}`].join('\n');
  const html = shell({
    preheader: lead,
    heading,
    paragraphs: [esc(lead)],
    button: { label: 'Start scoring', url: esc(i.url) },
    note: [others, ready].filter(Boolean).map(esc).join('<br>'),
    footer: footer(i, why),
  });
  return { subject, html, text };
}

export function progressReminderEmail(i: ProgressReminderInput): Email {
  const someone = i.done.length > 0;
  const subject = someone ? `${i.month}’s progress report is out. Add your scores to see it` : `${i.month}’s progress scoring is still open`;
  const heading = someone ? `${listNames(i.done)} ${i.done.length === 1 ? 'has' : 'have'} scored, ${i.firstName}. Add yours to see the report.` : `${i.month}’s progress scoring is still open, ${i.firstName}.`;
  const lead = someone
    ? `The report is already out with their scores. Yours are added as soon as you finish, and then you see it. More coaches make the scores steadier, and show where you see the kids differently.`
    : 'About two minutes: for each skill, move skaters up a level if they’ve moved. Your report is ready as soon as you finish.';
  const status = [...i.done.map((n) => [n, 'Done', GOOD] as const), ['You', 'About 2 minutes', INK2] as const];
  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GROUND};border-radius:10px;">${status
    .map(([n, s, c]) => `<tr><td style="padding:8px 18px;font:14px/20px ${BODY};color:${INK};">${esc(n)}</td><td align="right" style="padding:8px 18px;font:500 14px/20px ${BODY};color:${c};">${esc(s)}</td></tr>`)
    .join('')}</table>`;
  const note = someone ? 'You won’t see their answers first, and they won’t see yours. Not sure about a skater? Leave them where they were.' : '';
  const why = 'One reminder a month, at most.';
  const text = [heading, '', lead, '', ...(someone ? [...i.done.map((n) => `${n}: done`), 'You: about 2 minutes', ''] : []), `Start scoring: ${i.url}`, ...(note ? ['', note] : []), '', '—', `You’re getting this because you coach ${i.teamName} on Firstpass. ${why}`, `Turn progress emails off on your Team page: ${i.settingsUrl}`].join('\n');
  const html = shell({
    preheader: lead,
    heading,
    paragraphs: [esc(lead), ...(someone ? [table] : [])],
    button: { label: 'Start scoring', url: esc(i.url) },
    note: esc(note),
    footer: footer(i, why),
  });
  return { subject, html, text };
}

/** The skill that moved most this month, if any moved up. */
function mover(rows: ReportRow[]): ReportRow | null {
  const up = rows.filter((r) => r.change != null && r.change > 0).sort((a, b) => b.change! - a.change!);
  return up[0] ?? null;
}

export function progressReportEmail(i: ProgressReportInput): Email {
  const top = i.first ? null : mover(i.rows);
  const subject = i.first ? `Your first progress report: ${i.month}` : top ? `${i.month} progress report: ${lower(top.attribute)} up ${top.change!.toFixed(1)}` : `${i.month} progress report`;
  const heading = i.first ? 'Your first progress report is in.' : top ? `${top.attribute} moved most this month.` : `${i.month}’s progress report is in.`;
  const lead = i.first
    ? `This is where the team starts. Next month’s scoring shows what moved.`
    : top
      ? `Up ${top.change!.toFixed(1)} on last month, from ${i.coaches.length === 1 ? 'your scores' : 'your coaches’ scores'}.`
      : 'About the same as last month. Some months are like that at U7.';
  const by = `${i.teamName} · ${i.skaters} skaters · ${i.coaches.length === 1 ? `scored by ${i.coaches[0]}` : `scored by ${listNames(i.coaches)}`}`;
  const gap = i.gap
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GROUND};border-radius:10px;"><tr><td style="padding:16px 18px;">
<p style="margin:0 0 6px;font:600 15px/20px ${BODY};color:${INK};">You saw ${esc(lower(i.gap.attribute))} differently</p>
<p style="margin:0 0 6px;font:14px/20px ${MONO};color:${INK};">${esc(i.gap.coaches.map((c) => `${c.name} ${c.average.toFixed(1)}`).join(' · '))}</p>
<p style="margin:0;font:14px/20px ${BODY};color:${INK2};">A level or more apart. Worth a chat at the rink.</p>
</td></tr></table>`
    : '';
  const rows = i.rows
    .map((r, n) => {
      const b = n < i.rows.length - 1 ? `border-bottom:1px solid ${LINE};` : '';
      const c = r.change == null ? '' : signed(r.change);
      const color = r.change != null && r.change > 0 ? GOOD : r.change != null && r.change < 0 ? WARN : INK2;
      return `<tr><td style="padding:8px 0;${b}font:14px/20px ${BODY};color:${INK};">${esc(r.attribute)}</td><td align="right" style="padding:8px 0;${b}font:14px/20px ${MONO};color:${INK};">${r.score == null ? '–' : r.score.toFixed(1)}</td><td align="right" width="64" style="padding:8px 0;${b}font:12px/20px ${MONO};color:${color};">${esc(c)}</td></tr>`;
    })
    .join('');
  const all = `<p style="margin:0 0 4px;padding-bottom:8px;border-bottom:1px solid ${LINE};font:600 15px/20px ${BODY};color:${INK};">All six</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table><p style="margin:8px 0 0;font:12px/18px ${BODY};color:${INK2};">Progress score is the average level across your ${i.skaters} skaters${i.coaches.length > 1 ? ', from every coach who scored' : ''}. U7 levels.</p>`;
  const why = 'Once a month, after your team’s progress scoring. Only coaches who scored get it.';
  const text = [
    heading,
    by,
    '',
    lead,
    '',
    ...(i.gap ? [`You saw ${lower(i.gap.attribute)} differently: ${i.gap.coaches.map((c) => `${c.name} ${c.average.toFixed(1)}`).join(' · ')}. Worth a chat at the rink.`, ''] : []),
    ...i.rows.map((r) => `${r.attribute}: ${r.score == null ? '–' : r.score.toFixed(1)}${r.change == null ? '' : ` (${signed(r.change)})`}`),
    '',
    `See the full report: ${i.url}`,
    '',
    '—',
    `You’re getting this because you coach ${i.teamName} on Firstpass. ${why}`,
    `Turn progress emails off on your Team page: ${i.settingsUrl}`,
  ].join('\n');
  const html = shell({
    preheader: lead,
    heading,
    paragraphs: [`<span style="font:12px/18px ${MONO};color:${INK2};">${esc(by)}</span>`, esc(lead), ...(gap ? [gap] : []), all],
    button: { label: 'See the full report', url: esc(i.url) },
    footer: footer(i, why),
  });
  return { subject, html, text };
}
