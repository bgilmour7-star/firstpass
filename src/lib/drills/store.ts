import 'server-only';
import type { DiagramRequest, Drill, ReviewNote, Status } from './schema';

// The one seam between the review screens and where drills are stored.
// Production uses Supabase (Postgres + RLS). Local development without Supabase
// credentials uses the JSON files in content/drills, so the screens can be built
// and checked offline. Nothing else in the app talks to storage directly.

export type DrillSummary = {
  id: string;
  funName: string;
  plainName: string;
  status: Status;
  groupModel: Drill['groupModel'];
  levelCount: number;
  minutes: number;
  diagram: Drill['diagram'];
  openRequests: number;
  updatedAt: string | null;
};

export type DrillDetail = {
  drill: Drill;
  requests: DiagramRequest[];
  notes: ReviewNote[];
  updatedAt: string | null;
  updatedBy: string | null;
};

export interface DrillStore {
  readonly kind: 'supabase' | 'local';
  list(): Promise<DrillSummary[]>;
  get(id: string): Promise<DrillDetail | null>;
  save(drill: Drill, actor: string): Promise<void>;
  setStatus(id: string, status: Status, actor: string): Promise<void>;
  addDiagramRequest(drillId: string, note: string, actor: string, before: Drill['diagram']): Promise<void>;
  addNote(drillId: string, body: string, actor: string): Promise<void>;
  /** A reviewer closes an open request: the redraw looks right, or the request is no longer needed. */
  resolveDiagramRequest(requestId: string, drillId: string, resolution: string): Promise<void>;
}

export function usingSupabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function getDrillStore(): Promise<DrillStore> {
  if (usingSupabase()) {
    const { SupabaseDrillStore } = await import('./store-supabase');
    return new SupabaseDrillStore();
  }
  if (process.env.NODE_ENV === 'production' && process.env.FIRSTPASS_ALLOW_LOCAL_STORE !== '1') {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  const { LocalDrillStore } = await import('./store-local');
  return new LocalDrillStore();
}
