import 'server-only';
import { usingSupabase } from '../drills/store';
import type { Device, EventName, PageEvent, WaitlistEntry, WaitlistInput, WaitlistStatus } from './schema';
import type { UsageRows } from './usage';
import type { MetricName, PageGroup, Vital } from './vitals';

// The one seam for the public site (decision 0019). Supabase in production: anyone may join the
// waitlist and record a visit (security-definer functions), only Brett reads them (RLS). A JSON
// file in local mode. Nothing else talks to storage directly.
export type NewEvent = { name: EventName; path: string; ip: string | null; agent: string | null; source: string | null; device: Device; region: string | null };

export interface SiteStore {
  /** Joins, or updates the row when the email is already on the list. isNew is false for a repeat. Throws 'waitlist-migration-missing' before the SQL has run. */
  join(input: WaitlistInput): Promise<{ isNew: boolean }>;
  /** Sign-up is invite-only: may this email create an account without a join link? */
  canCreateAccount(email: string): Promise<boolean>;
  record(event: NewEvent): Promise<void>;
  /** Newest first. Analytics viewers only (RLS). */
  waitlist(): Promise<WaitlistEntry[]>;
  events(sinceIso: string): Promise<PageEvent[]>;
  setStatus(id: string, status: WaitlistStatus): Promise<void>;
  /** Page speed from a real visit (decision 0025). Anyone; never throws. */
  recordVitals(page: PageGroup, device: Device, metrics: { name: MetricName; value: number }[]): Promise<void>;
  /** The signed-in coach opened the app today, from the home screen or not. Never throws. */
  recordAppOpen(userId: string, installed: boolean, device: Device): Promise<void>;
  /** Analytics viewers only. Throw 'usage-migration-missing' before the SQL has run. */
  vitals(sinceIso: string): Promise<Vital[]>;
  usage(sinceIso: string): Promise<UsageRows>;
}

export async function getSiteStore(): Promise<SiteStore> {
  if (usingSupabase()) {
    const { SupabaseSiteStore } = await import('./store-supabase');
    return new SupabaseSiteStore();
  }
  const { LocalSiteStore } = await import('./store-local');
  return new LocalSiteStore();
}
