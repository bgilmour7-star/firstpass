import 'server-only';
import { usingSupabase } from '../drills/store';
import type { Device, EventName, PageEvent, WaitlistEntry, WaitlistInput, WaitlistStatus } from './schema';
import type { UsageRows } from './usage';
import type { ProgressUsageRows } from '../progress/usage';
import type { MetricName, PageGroup, Vital } from './vitals';

// The one seam for the public site (decision 0019). Supabase in production: anyone may join the
// waitlist and record a visit (security-definer functions), only Brett reads them (RLS). A JSON
// file in local mode. Nothing else talks to storage directly.
export type NewEvent = { name: EventName; path: string; ip: string | null; agent: string | null; source: string | null; device: Device; region: string | null; signedIn?: boolean };

export interface SiteStore {
  /** Joins, or updates the row when the email is already on the list. isNew is false for a repeat. Throws 'waitlist-migration-missing' before the SQL has run. */
  join(input: WaitlistInput): Promise<{ isNew: boolean }>;
  /** Onboarded on the waitlist. Unused since sign-up opened (decision 0033); kept so invite-only can return. */
  canCreateAccount(email: string): Promise<boolean>;
  record(event: NewEvent): Promise<void>;
  /** Newest first. Analytics viewers only (RLS). */
  waitlist(): Promise<WaitlistEntry[]>;
  events(sinceIso: string): Promise<PageEvent[]>;
  setStatus(id: string, status: WaitlistStatus): Promise<void>;
  /** Page speed from a real visit (decision 0029). Anyone; never throws. */
  recordVitals(page: PageGroup, device: Device, metrics: { name: MetricName; value: number }[]): Promise<void>;
  /** The signed-in coach opened the app today, from the home screen or not. Never throws. */
  recordAppOpen(userId: string, installed: boolean, device: Device): Promise<void>;
  /** Analytics viewers only. Throw 'usage-migration-missing' before the SQL has run. */
  vitals(sinceIso: string): Promise<Vital[]>;
  usage(sinceIso: string): Promise<UsageRows>;
  /** Progress scoring for one month, YYYY-MM-01 (decision 0030). Throws 'progress-usage-migration-missing' before its SQL. */
  progressUsage(month: string): Promise<ProgressUsageRows>;
  /** When each team was created, each coach first joined a team and each account was made (decision 0034), as ISO timestamps. Timestamps only, no names. Throws 'growth-migration-missing' before the SQL has run. */
  growth(): Promise<Growth>;
  /** Accounts made since then, where each came from and how far it got (decision 0052). No ids or emails. Throws 'account-sources-migration-missing' before its SQL. */
  accountSources(sinceIso: string): Promise<AccountSource[]>;
  /** Every team (not admin-only), all time: when made, age group, first check-in, active weeks (decision 0053). Throws 'team-weeks-migration-missing' before its SQL. */
  teamWeeks(): Promise<TeamWeeks[]>;
  /** Failures the app caught since then (decision 0054), newest first. Throws 'app-errors-migration-missing' before its SQL. */
  appErrors(sinceIso: string): Promise<AppError[]>;
}

/** A caught failure: its area ("email", "join") and a scrubbed message. */
export type AppError = { occurredAt: string; area: string; message: string };

/** One team, unnamed: its active weeks are Mondays (Vancouver), with whether that week had a check-in. */
export type TeamWeeks = { createdAt: string; ageGroup: string | null; firstCheckinAt: string | null; weeks: { week: string; checkedIn: boolean }[] };

/** One account: its same-day visit (traced) if any, and whether its coach made a team and ran a practice. */
export type AccountSource = { createdAt: string; invited: boolean; traced: boolean; source: string | null; landing: string | null; madeTeam: boolean; ranPractice: boolean };

export type Growth = { teams: string[]; coaches: string[]; accounts: string[] };

export async function getSiteStore(): Promise<SiteStore> {
  if (usingSupabase()) {
    const { SupabaseSiteStore } = await import('./store-supabase');
    return new SupabaseSiteStore();
  }
  const { LocalSiteStore } = await import('./store-local');
  return new LocalSiteStore();
}
