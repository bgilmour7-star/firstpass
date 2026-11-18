import 'server-only';
import { usingSupabase } from '../drills/store';
import type { Age, Broadcast, Draft, Recipient, Segment, SendCounts, Stats } from './schema';

// The one seam for emails to coaches (decision 0035). Supabase in production, Brett only (RLS on
// can_see_analytics()); a JSON file in local mode (.local/broadcasts.json) so the screens can be built offline,
// where nothing is ever sent.

/** optedOut: stopped update or survey emails after the send started. They're skipped, never sent. */
export type Queued = { sendId: string; personId: string; email: string; firstName: string | null; unsubscribeToken: string; optedOut: boolean };

export interface BroadcastStore {
  /** Newest first. Throws 'broadcasts-migration-missing' before the SQL has run. */
  list(): Promise<Broadcast[]>;
  get(id: string): Promise<Broadcast | null>;
  create(): Promise<string>;
  /** Drafts only. False if it isn't a draft any more. */
  save(id: string, draft: Draft): Promise<boolean>;
  /** Drafts only. */
  remove(id: string): Promise<boolean>;
  recipients(segment: Segment, age: Age | null): Promise<Recipient[]>;
  /**
   * Draft → sending, with one queued row per recipient, in one transaction (start_broadcast). Returns how many were
   * queued, or 0 if it was already started. Throws 'list-changed:<n>' if the segment isn't `expected` people any more.
   */
  start(id: string, expected: number): Promise<number>;
  queued(id: string, limit: number): Promise<Queued[]>;
  mark(sendIds: string[], outcome: { sent: true } | { sent: false; error: string }): Promise<void>;
  /** Sending → sent once nothing is queued. */
  finish(id: string): Promise<void>;
  counts(id: string): Promise<SendCounts>;
  /** Public URL of an uploaded image. Local mode can't host images and throws 'no-images-locally'. */
  uploadImage(type: string, bytes: ArrayBuffer): Promise<string>;
  /** Null until 20261124000000_email_attribution.sql has run. */
  stats(id: string): Promise<Stats | null>;
  /** A signed-in coach arrived from an email link (decision 0036). */
  recordClick(ref: string, link: number): Promise<'stored' | 'ignored' | 'signed-out'>;
  updatesStatus(token: string): Promise<boolean | null>;
  updatesOff(token: string): Promise<boolean>;
}

export async function getBroadcastStore(): Promise<BroadcastStore> {
  if (usingSupabase()) {
    const { SupabaseBroadcastStore } = await import('./store-supabase');
    return new SupabaseBroadcastStore();
  }
  const { LocalBroadcastStore } = await import('./store-local');
  return new LocalBroadcastStore();
}
