import 'server-only';
import type { Drill } from '../drills/schema';
import { usingSupabase } from '../drills/store';
import type { Practice, Team } from '../plans/schema';
import type { IceEvent } from '../calendar/ics';
import type { PracticeActivity, Snapshot } from '../plans/activity';
import type { Checkin } from '../plans/checkin';

// The seam between coach screens and storage (teams, practices, the live drill library).
// Supabase in production (RLS by team membership); a JSON file in .local/ in local mode.

/** A suggestion from the check-in that a coach chose to keep as is. */
export type KeptSuggestion = { key: string; editor: string; at: string };

export type NewPractice = Omit<Practice, 'id'>;
export type Share = { token: string; expiresAt: string };
/** A drill a coach starred for the team (decision 0012). */
export type Favorite = { by: string; at: string };
export type TeamCoach = { userId: string; email: string; firstName: string | null; role: 'head_coach' | 'coach'; joinedAt: string };
/** What a join link is for, shown before joining, even signed out (decisions 0011, 0013). */
export type JoinPreview = { id: string; name: string; inviter: string | null; next: { date: string; startTime: string; ice: 'half' | 'full'; blocks: number } | null };
/** Why joining through a link failed (decision 0011). A coach may be on several teams (decision 0026). */
export type JoinError = 'link-off' | 'join-migration-missing';
/** A team the coach is on, with their role on it (decision 0026). */
export type MyTeam = Team & { role: 'head_coach' | 'coach' };
/** Everything the Create a team wizard sets up front (decision 0026). */
export type TeamSetup = Partial<Pick<Team, 'ageGroup' | 'ice' | 'groups' | 'practiceMinutes' | 'coachesOnIce' | 'newDrillsPerWeek' | 'gear' | 'focus'>>;
/** A U11+ coach's answer on the "not yet" screen (decision 0026). Never kids' names. */
export type OlderInterest = { ageGroup: 'U11' | 'U13' | 'U15+'; hardestPart: string; wantsCall: boolean };
/** What a parent link shows: no ids beyond the drills, no coach names. */
export type SharedPractice = { team: string; groups: Team['groups'] | null; practice: Pick<Practice, 'date' | 'startTime' | 'minutes' | 'ice' | 'blocks' | 'attendance'>; drills: Drill[] };

/** An ice time read from the team's calendar, with what the coach did with it. */
export type IceTime = Omit<IceEvent, never> & { id: string; teamId: string; ignored: boolean; practiceId: string | null; movedFrom: string | null };
export type IceTimeRow = Omit<IceTime, 'id' | 'teamId'>;

export interface AppStore {
  /** Every team the coach is on, newest membership first (decision 0026). */
  myTeams(userId: string): Promise<MyTeam[]>;
  /** With teamId: that team, only if the coach is on it. Without: their most recently joined team. */
  myTeam(userId: string, teamId?: string): Promise<Team | null>;
  /** Create a team with this coach as head coach. */
  createTeam(name: string, userId: string, setup?: TeamSetup): Promise<Team>;
  updateTeam(team: Team): Promise<void>;
  /** A coach leaves a team. The head coach can't leave (they delete it instead): throws 'head-coach-leaves'. */
  leaveTeam(teamId: string, userId: string): Promise<void>;
  /** Head coach: delete the team and everything on it. Throws 'not-head-coach'. */
  deleteTeam(teamId: string): Promise<void>;
  /** The "U11 or older" discovery answer. Throws 'older-migration-missing' before the SQL has run. */
  saveOlderInterest(userId: string, answer: OlderInterest): Promise<void>;
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
  /** The latest entry in a practice's edit log, to merge saves from one editing session. */
  latestEdit(practiceId: string): Promise<{ id: string; userId: string | null; at: string; base: Snapshot | null } | null>;
  addEdit(e: { practiceId: string; teamId: string; userId: string; editor: string; summary: string; base: Snapshot | null }): Promise<void>;
  updateEdit(id: string, patch: { summary: string; at: string }): Promise<void>;
  /** When this coach opened the practice, for the "changed since you last looked" dot. */
  markViewed(practiceId: string, userId: string): Promise<void>;
  /** Each practice's edits (newest first) and when this coach last looked at it. */
  teamActivity(teamId: string, userId: string): Promise<Record<string, PracticeActivity>>;
  /** Every coach's check-ins for the team (small: a few rows per practice). */
  teamCheckins(teamId: string): Promise<Checkin[]>;
  saveCheckin(c: Checkin): Promise<void>;
  /** Suggestions a coach kept as is on a plan (decision 0022), hidden for the whole team. */
  keptSuggestions(practiceId: string): Promise<KeptSuggestion[]>;
  keepSuggestion(k: { practiceId: string; teamId: string; userId: string; editor: string; key: string }): Promise<void>;
  /** How many coaches are on the team, for "2 of 3 checked in". */
  coachCount(teamId: string): Promise<number>;

  /** The after-practice email (decision 0010): on unless this coach turned it off. */
  checkinEmails(teamId: string, userId: string): Promise<boolean>;
  setCheckinEmails(teamId: string, userId: string, on: boolean): Promise<void>;

  /** Coaches and the join link (decision 0011). Head-coach-only changes throw 'not-head-coach'. */
  coaches(teamId: string): Promise<TeamCoach[]>;
  joinCode(teamId: string): Promise<string | null>;
  newJoinCode(teamId: string): Promise<string>;
  turnOffJoinCode(teamId: string): Promise<void>;
  joinCodeTeam(code: string): Promise<JoinPreview | null>;
  /** Join as a coach. Throws an Error whose message is a JoinError. */
  joinTeam(code: string, userId: string): Promise<string>;
  removeCoach(teamId: string, userId: string): Promise<void>;

  /** Team favourite drills, by drill id (decision 0012). */
  favorites(teamId: string): Promise<Record<string, Favorite>>;
  /** Star or unstar a drill for the team. Throws 'favorites-migration-missing' before the SQL has run. */
  setFavorite(teamId: string, userId: string, editor: string, drillId: string, on: boolean): Promise<void>;
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
