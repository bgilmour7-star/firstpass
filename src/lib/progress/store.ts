import 'server-only';
import { usingSupabase } from '../drills/store';
import type { Practice, Team } from '../plans/schema';
import type { Attribute } from './levels';
import type { Answers, CoachScore, Round } from './report';

// The seam between progress screens and storage (decision 0030). Supabase in production: RLS shows
// a coach their own scores, and teammates' scores only once they've finished their own round.
// A JSON file in .local/ in local mode, where rounds open on read (there is no timer).

export type ScoreSave = { roundId: string; answers: Answers; done: Attribute[]; noChange: Attribute[]; seconds: number; finish: boolean };
/** Whether each coach on the team scores progress (head coach sets), by user id. */
/** One coach's progress through a round. */
export type RoundStatus = { userId: string; done: number; finished: boolean };
export type ScoringFlags = Record<string, boolean>;

export interface ProgressStore {
  /** The team's rounds, newest first. `null` means the migration hasn't run yet. */
  rounds(teamId: string): Promise<Round[] | null>;
  /** Scores this coach may see: their own, plus teammates' in rounds they've finished (names left blank). */
  scores(teamId: string): Promise<Omit<CoachScore, 'name'>[]>;
  saveScore(teamId: string, userId: string, s: ScoreSave): Promise<void>;
  /** Who has started and finished a round, without anyone's answers (for "1 of 3 done"). */
  status(roundId: string): Promise<RoundStatus[]>;
  scoringFlags(teamId: string): Promise<ScoringFlags>;
  /** Head coach only: throws 'not-head-coach'. */
  setScoring(teamId: string, userId: string, on: boolean): Promise<void>;
  /** Local mode only: open this month's round like the timer would. Supabase: no-op (the timer does it). */
  openDueRound(team: Team, practices: Practice[], now?: Date): Promise<void>;
}

export async function getProgressStore(): Promise<ProgressStore> {
  if (usingSupabase()) {
    const { SupabaseProgressStore } = await import('./store-supabase');
    return new SupabaseProgressStore();
  }
  const { LocalProgressStore } = await import('./store-local');
  return new LocalProgressStore();
}
