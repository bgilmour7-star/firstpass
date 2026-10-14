import 'server-only';
import type { Drill } from '../drills/schema';
import { usingSupabase } from '../drills/store';
import type { Practice, Team } from '../plans/schema';

// The seam between coach screens and storage (teams, practices, the live drill library).
// Supabase in production (RLS by team membership); a JSON file in .local/ in local mode.

export type NewPractice = Omit<Practice, 'id'>;
export type Share = { token: string; expiresAt: string };
/** What a parent link shows: no ids beyond the drills, no coach names. */
export type SharedPractice = { team: string; practice: Pick<Practice, 'date' | 'startTime' | 'minutes' | 'ice' | 'blocks'>; drills: Drill[] };

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
