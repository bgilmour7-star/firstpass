// Builds the progress emails' inputs from what the database hands the cron route (decision 0030).
// Pure, so it's tested without Supabase or Resend.

import type { ProgressReminderInput, ProgressReportInput, ProgressScoringInput } from '../email/progress-emails';
import { GAP_FLAG, monthName, teamReport, type Answers, type CoachScore, type Round } from './report';

export type Due = { kind: 'scoring' | 'reminder' | 'report'; round_id: string; team_id: string; month: string; user_id: string; email: string; first_name: string; team_name: string; skaters: number };
/** progress_email_scores: every coach on the team for this round and the one before. */
export type ScoreRow = { round_id: string; month: string; skaters: number; user_id: string; first_name: string; scores: boolean; finished: boolean; answers: Answers | null };

export type Links = { site: string };

function rounds(rows: ScoreRow[]) {
  const byId = new Map<string, Round>();
  for (const r of rows) if (!byId.has(r.round_id)) byId.set(r.round_id, { id: r.round_id, teamId: '', month: r.month, openedAt: '', closedAt: null, levelsVersion: '', skaters: r.skaters });
  return [...byId.values()].sort((a, b) => b.month.localeCompare(a.month));
}
const asScores = (rows: ScoreRow[]): CoachScore[] =>
  rows.filter((r) => r.finished && r.answers).map((r) => ({ roundId: r.round_id, userId: r.user_id, name: r.first_name, answers: r.answers!, done: [], noChange: [], startedAt: '', finishedAt: 'done', seconds: null }));

const common = (d: Due, l: Links) => ({ teamName: d.team_name, month: monthName(d.month), firstName: d.first_name, settingsUrl: `${l.site}/team#emails` });

export function scoringInput(d: Due, rows: ScoreRow[], l: Links): ProgressScoringInput {
  const prev = rounds(rows).find((r) => r.id !== d.round_id);
  const scoredLast = prev ? rows.some((r) => r.round_id === prev.id && r.user_id === d.user_id && r.finished) : false;
  const others = rows.filter((r) => r.round_id === d.round_id && r.scores && r.user_id !== d.user_id).map((r) => r.first_name);
  return { ...common(d, l), url: `${l.site}/progress/score`, skaters: d.skaters, previousMonth: prev && scoredLast ? monthName(prev.month) : null, others };
}

export function reminderInput(d: Due, rows: ScoreRow[], l: Links): ProgressReminderInput {
  const done = rows.filter((r) => r.round_id === d.round_id && r.finished && r.user_id !== d.user_id).map((r) => r.first_name);
  return { ...common(d, l), url: `${l.site}/progress/score`, done };
}

/** Null when nobody has finished (never happens for a claimed report, which needs the reader to have). */
export function reportInput(d: Due, rows: ScoreRow[], l: Links): ProgressReportInput | null {
  const all = rounds(rows);
  const cur = all.find((r) => r.id === d.round_id);
  if (!cur) return null;
  const prev = all.find((r) => r.id !== d.round_id) ?? null;
  const scores = asScores(rows);
  const before = prev ? teamReport(prev, scores) : null;
  const rep = teamReport(cur, scores, before);
  if (!rep.coaches.length) return null;
  const widest = rep.attributes.filter((a) => a.gap != null && a.gap >= GAP_FLAG).sort((a, b) => b.gap! - a.gap!)[0];
  return {
    ...common(d, l),
    url: `${l.site}/progress`,
    skaters: cur.skaters,
    coaches: rep.coaches.map((c) => c.name),
    rows: rep.attributes.map((a) => ({ attribute: a.attribute, score: a.score, change: a.change })),
    gap: widest ? { attribute: widest.attribute, coaches: widest.coaches.filter((c) => c.average != null).map((c) => ({ name: c.name, average: c.average! })) } : null,
    first: !before || !before.coaches.length,
  };
}
