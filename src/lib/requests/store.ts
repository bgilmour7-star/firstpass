import 'server-only';
import { usingSupabase } from '../drills/store';
import type { DrillRequest, RequestInput } from './schema';

// The one seam for drill requests (decision 0018). Supabase in production (RLS: coaches see their
// own team's, admins see all); a JSON file in local mode. Nothing else talks to storage directly.
export interface RequestStore {
  /** A coach sends a request. Throws 'request-limit' at 5 open for the team, 'requests-migration-missing' before the SQL has run. */
  create(input: RequestInput, at: { teamId: string; userId: string; name: string; email: string }): Promise<DrillRequest>;
  /** The team's requests, newest first (coach side). */
  forTeam(teamId: string): Promise<DrillRequest[]>;
  /** Every request, newest first (admins). */
  all(): Promise<DrillRequest[]>;
  get(id: string): Promise<DrillRequest | null>;
  /** An admin's decision. Returns the request as it was before, or null if it wasn't open. */
  decide(id: string, state: 'accepted' | 'declined', reason: string | null): Promise<DrillRequest | null>;
  markCoachEmailed(id: string): Promise<void>;
}

export async function getRequestStore(): Promise<RequestStore> {
  if (usingSupabase()) {
    const { SupabaseRequestStore } = await import('./store-supabase');
    return new SupabaseRequestStore();
  }
  const { LocalRequestStore } = await import('./store-local');
  return new LocalRequestStore();
}
