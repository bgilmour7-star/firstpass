import 'server-only';
import { usingSupabase } from '../drills/store';
import type { Audience, CallStatus, GiftCard, Invite, Note, NoteKind, Person, SendStats, SurveyResponse, Usage } from './schema';

// The one seam for discovery data (decision 0027). Supabase in production: the public survey and
// unsubscribe pages go through token functions, everything else is Brett only (RLS on
// can_see_analytics()). A JSON file in local mode (.local/discovery.json), seeded with sample people
// so the screens can be built offline. Nothing else talks to storage directly.

export type SubmitResult = 'ok' | 'used' | 'unknown';
export type ThemeTarget = { kind: 'response' | 'note'; id: string };

export interface DiscoveryStore {
  // Public, by token
  invite(token: string): Promise<Invite | null>;
  submit(token: string, row: Record<string, unknown>): Promise<SubmitResult>;
  unsubscribeStatus(token: string): Promise<{ audience: Audience; unsubscribed: boolean } | null>;
  unsubscribe(token: string): Promise<boolean>;

  // Brett only. These throw 'discovery-migration-missing' before the SQL has run.
  people(): Promise<Person[]>;
  /** Newest first, including U11+ coaches from older_team_interest when that table exists. */
  responses(): Promise<SurveyResponse[]>;
  notes(personId?: string): Promise<Note[]>;
  addNote(personId: string, kind: NoteKind, body: string): Promise<void>;
  setCallStatus(responseId: string, status: CallStatus): Promise<void>;
  setGiftCard(responseId: string, card: GiftCard): Promise<void>;
  setThemes(target: ThemeTarget, themes: string[]): Promise<void>;
  themes(): Promise<string[]>;
  usage(): Promise<Usage[]>;
  /** Outbox counts since a date, per journey step. */
  sendStats(sinceIso: string): Promise<SendStats>;
  /** The person's survey link token, for Brett to send by hand. */
  surveyToken(personId: string): Promise<string | null>;
}

export async function getDiscoveryStore(): Promise<DiscoveryStore> {
  if (usingSupabase()) {
    const { SupabaseDiscoveryStore } = await import('./store-supabase');
    return new SupabaseDiscoveryStore();
  }
  const { LocalDiscoveryStore } = await import('./store-local');
  return new LocalDiscoveryStore();
}
