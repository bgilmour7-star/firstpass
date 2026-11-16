import 'server-only';
import { supabaseServer } from '../supabase/server';
import type { Attribute } from './levels';
import type { Answers, CoachScore, Counts, Round } from './report';
import type { Goal } from './pace';
import type { ProgressStore, RoundStatus, ScoreSave, ScoringFlags } from './store';

// Every query runs as the signed-in coach. RLS limits rounds to their teams and scores to their own,
// plus teammates' once they've finished (supabase/migrations/20261116000000_team_progress.sql).

type RoundRow = { id: string; team_id: string; month: string; opened_at: string; closed_at: string | null; levels_version: string; skaters: number; remind_at?: string | null };
type ScoreRow = { round_id: string; user_id: string; answers: Answers; done: string[]; no_change: string[]; started_at: string; finished_at: string | null; seconds: number | null };

const missing = (m: string) => /progress_|relation|schema cache|function/i.test(m);

export class SupabaseProgressStore implements ProgressStore {
  async rounds(teamId: string): Promise<Round[] | null> {
    const db = await supabaseServer();
    const { data, error } = await db.from('progress_rounds').select('*').eq('team_id', teamId).order('month', { ascending: false });
    if (error) return missing(error.message) ? null : [];
    return ((data ?? []) as RoundRow[]).map((r) => ({ id: r.id, teamId: r.team_id, month: r.month, openedAt: r.opened_at, closedAt: r.closed_at, levelsVersion: r.levels_version, skaters: r.skaters, remindAt: r.remind_at ?? null }));
  }
  async scores(teamId: string): Promise<Omit<CoachScore, 'name'>[]> {
    const db = await supabaseServer();
    const { data, error } = await db.from('progress_scores').select('round_id, user_id, answers, done, no_change, started_at, finished_at, seconds').eq('team_id', teamId);
    if (error) return [];
    return ((data ?? []) as ScoreRow[]).map((r) => ({ roundId: r.round_id, userId: r.user_id, answers: r.answers ?? {}, done: r.done as Attribute[], noChange: r.no_change as Attribute[], startedAt: r.started_at, finishedAt: r.finished_at, seconds: r.seconds }));
  }
  async saveScore(_teamId: string, _userId: string, s: ScoreSave) {
    const db = await supabaseServer();
    const { error } = await db.rpc('save_progress_score', { r: s.roundId, answers: s.answers, done: s.done, no_change: s.noChange, secs: s.seconds, finish: s.finish });
    if (error) {
      const known = error.message.match(/round-closed|not-scoring|bad-counts|bad-attribute|bad-answers|no-round/);
      throw new Error(known ? known[0] : missing(error.message) ? 'progress-migration-missing' : error.message);
    }
  }
  async status(roundId: string): Promise<RoundStatus[]> {
    const db = await supabaseServer();
    const { data, error } = await db.rpc('progress_round_status', { r: roundId });
    if (error) return [];
    return ((data ?? []) as { user_id: string; done: number; finished: boolean }[]).map((r) => ({ userId: r.user_id, done: r.done, finished: r.finished }));
  }
  async scoringFlags(teamId: string): Promise<ScoringFlags> {
    const db = await supabaseServer();
    const { data, error } = await db.from('team_members').select('user_id, progress_scoring').eq('team_id', teamId);
    if (error) return {};
    return Object.fromEntries(((data ?? []) as { user_id: string; progress_scoring: boolean }[]).map((r) => [r.user_id, r.progress_scoring]));
  }
  async setScoring(teamId: string, userId: string, on: boolean) {
    const db = await supabaseServer();
    const { error } = await db.rpc('set_progress_scoring', { team: teamId, coach: userId, wanted: on });
    if (error) throw new Error(/not-head-coach/.test(error.message) ? 'not-head-coach' : missing(error.message) ? 'progress-migration-missing' : error.message);
  }
  async emailsOn(teamId: string, userId: string) {
    const db = await supabaseServer();
    const { data, error } = await db.from('team_members').select('progress_emails').eq('team_id', teamId).eq('user_id', userId).maybeSingle();
    if (error || !data) return true;
    return (data as { progress_emails: boolean }).progress_emails;
  }
  async setEmails(teamId: string, _userId: string, on: boolean) {
    const db = await supabaseServer();
    const { error } = await db.rpc('set_progress_emails', { team: teamId, wanted: on });
    if (error) throw new Error(missing(error.message) ? 'progress-migration-missing' : error.message);
  }
  async remind(roundId: string) {
    const db = await supabaseServer();
    const { error } = await db.rpc('send_progress_reminder', { r: roundId });
    if (error) throw new Error(/not-head-coach/.test(error.message) ? 'not-head-coach' : /round-closed/.test(error.message) ? 'round-closed' : /too-early/.test(error.message) ? 'too-early' : missing(error.message) ? 'progress-migration-missing' : error.message);
  }
  async goals(teamId: string): Promise<Goal[]> {
    const db = await supabaseServer();
    const { data, error } = await db.from('progress_goals').select('id, attribute, target, by_date, baseline_round_id, baseline_score, set_at').eq('team_id', teamId).is('ended_at', null).order('set_at');
    if (error) return [];
    return ((data ?? []) as { id: string; attribute: Attribute; target: number[]; by_date: string; baseline_round_id: string; baseline_score: number | string; set_at: string }[]).map((g) => ({ id: g.id, attribute: g.attribute, target: g.target as Counts, byDate: g.by_date, baselineRoundId: g.baseline_round_id, baselineScore: Number(g.baseline_score), setAt: g.set_at }));
  }
  async setGoal(teamId: string, _userId: string, g: { attribute: Attribute; target: Counts; byDate: string }) {
    const db = await supabaseServer();
    const { error } = await db.rpc('set_progress_goal', { team: teamId, attr: g.attribute, target: g.target, by_date: g.byDate });
    if (error) {
      const known = error.message.match(/not-head-coach|no-report|too-many-goals|bad-target|bad-date|bad-attribute/);
      throw new Error(known ? known[0] : missing(error.message) ? 'goals-migration-missing' : error.message);
    }
  }
  async endGoal(_teamId: string, goalId: string) {
    const db = await supabaseServer();
    const { error } = await db.rpc('end_progress_goal', { goal: goalId });
    if (error) throw new Error(/not-head-coach/.test(error.message) ? 'not-head-coach' : missing(error.message) ? 'goals-migration-missing' : error.message);
  }
  async recordView(roundId: string) {
    const db = await supabaseServer();
    await db.rpc('record_report_view', { r: roundId }).then(() => undefined, () => undefined);
  }
  async recordGoalTaken(practiceId: string, key: string) {
    const db = await supabaseServer();
    await db.rpc('record_goal_suggestion', { practice: practiceId, k: key }).then(() => undefined, () => undefined);
  }
  async openDueRound() {
    // The database timer opens rounds (open_progress_rounds, every 10 minutes).
  }
}
