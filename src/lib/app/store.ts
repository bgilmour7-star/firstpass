import 'server-only';
import type { Drill } from '../drills/schema';
import { usingSupabase } from '../drills/store';
import type { Practice, Team } from '../plans/schema';
import type { IceEvent } from '../calendar/ics';

// The seam between coach screens and storage (teams, practices, the live drill library).
// Supabase in production (RLS by team membership); a JSON file in .local/ in local mode.

export type NewPractice = Omit<Practice, 'id'>;
export type Share = { token: string; expiresAt: string };
/** What a parent link shows: no ids beyond the drills, no coach names. */
export type SharedPractice = { team: string; groups: Team['groups'] | null; practice: Pick<Practice, 'date' | 'startTime' | 'minutes' | 'ice' | 'blocks' | 'attendance'>; drills: Drill[] };

/** An ice time read from the team's calendar, with what the coach did with it. */
export type IceTime = Omit<IceEvent, never> & { id: string; teamId: string; ignored: boolean; practiceId: string | null; movedFrom: string | null };
export type IceTimeRow = Omit<IceTime, 'id' | 'teamId'>;

export interface AppStore {
  myTeam(userId: string): Promise<Team | null>;
  createTeam(name: string, userId: string): Promise<Team>;
  updateTeam(team: Team): Promise<void>;
  listPractices(teamId: string): Promise<Practice[]>;
  getPractice(id: string): Promise<Practice | null>;
  createPractice(p: NewPractice, userId: string): Promise<Practice>;
  savePractice(p: Practice): Promise<void>;
  deletePractice(id: string): Promise<void>;
  /** Drills coaches can use: live ones (local mode: every drill, so screens can be built offline). */
  libraryDrills(): Promise<Drill[]>;
  /** The practice's current parent link, if one is active. */
  activeShare(practiceId: string): Promise<Share | null>;
  createShare(practiceId: string, teamId: string, userId: string): Promise<Share>;
  revokeShares(practiceId: string): Promise<void>;
  /** Public: read a practice by its link. Null when revoked, expired or unknown. */
  sharedPractice(token: string): Promise<SharedPractice | null>;
  /** The team's calendar link (TeamSnap, Google, any iCal feed) and when it was last read. */
  calendar(teamId: string): Promise<{ url: string; syncedAt: string | null } | null>;
  setCalendar(teamId: string, url: string | null): Promise<void>;
  markCalendarSynced(teamId: string, at: string): Promise<void>;
  iceTimes(teamId: string): Promise<IceTime[]>;
  /** Insert or update by calendar UID. */
  upsertIceTimes(teamId: string, rows: IceTimeRow[]): Promise<void>;
  setIceTime(id: string, patch: { ignored?: boolean; practiceId?: string | null }): Promise<void>;
}

export function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Buffer.from(bytes).toString('base64url');
}

export async function getAppStore(): Promise<AppStore> {
  if (usingSupabase()) {
    const { SupabaseAppStore } = await import('./store-supabase');
    return new SupabaseAppStore();
  }
  const { LocalAppStore } = await import('./store-local');
  return new LocalAppStore();
}
