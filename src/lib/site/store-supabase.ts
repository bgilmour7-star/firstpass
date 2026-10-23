import 'server-only';
import { supabaseServer } from '../supabase/server';
import type { Device, PageEvent, WaitlistEntry, WaitlistInput, WaitlistStatus } from './schema';
import type { UsageRows } from './usage';
import type { MetricName, PageGroup, Vital } from './vitals';
import type { NewEvent, SiteStore } from './store';

type WaitlistRow = { id: string; email: string; kind: WaitlistEntry['kind']; age_group: string | null; org_name: string | null; team_count: number | null; source: string | null; status: WaitlistStatus; created_at: string };
type EventRow = { occurred_at: string; name: PageEvent['name']; visitor: string; source: string | null; device: PageEvent['device']; region: string | null };

const missing = (e: { code?: string; message: string }) => e.code === 'PGRST202' || e.code === '42P01' || e.code === '42883' || /does not exist|could not find the function/i.test(e.message);

export class SupabaseSiteStore implements SiteStore {
  async join(i: WaitlistInput) {
    const db = await supabaseServer();
    const { data, error } = await db.rpc('join_waitlist', { address: i.email, joining_as: i.kind, age: i.ageGroup, org: i.orgName, teams: i.teamCount, came_from: i.source });
    if (error) throw new Error(missing(error) ? 'waitlist-migration-missing' : error.message);
    return { isNew: data === true };
  }

  async canCreateAccount(email: string) {
    const db = await supabaseServer();
    const { data, error } = await db.rpc('can_create_account', { address: email });
    if (error) {
      // Before the migration has run nobody can sign up without a join link: invite-only fails closed.
      console.error('[site] can_create_account failed: %s', error.message);
      return false;
    }
    return data === true;
  }

  async record(e: NewEvent) {
    const db = await supabaseServer();
    const { error } = await db.rpc('record_page_event', { event: e.name, page: e.path, ip: e.ip, agent: e.agent, came_from: e.source, kind_of_device: e.device, place: e.region });
    if (error && !missing(error)) console.error('[site] record_page_event failed: %s', error.message);
  }

  async waitlist() {
    const db = await supabaseServer();
    const { data, error } = await db.from('waitlist').select('id, email, kind, age_group, org_name, team_count, source, status, created_at').order('created_at', { ascending: false });
    if (error) throw new Error(missing(error) ? 'waitlist-migration-missing' : error.message);
    return ((data ?? []) as WaitlistRow[]).map((r) => ({ id: r.id, email: r.email, kind: r.kind, ageGroup: r.age_group, orgName: r.org_name, teamCount: r.team_count, source: r.source, status: r.status, createdAt: r.created_at }));
  }

  async events(sinceIso: string) {
    const db = await supabaseServer();
    const out: PageEvent[] = [];
    // Supabase returns at most 1,000 rows a request; page through.
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from('page_events').select('occurred_at, name, visitor, source, device, region').gte('occurred_at', sinceIso).order('occurred_at').range(from, from + 999);
      if (error) throw new Error(missing(error) ? 'waitlist-migration-missing' : error.message);
      const rows = (data ?? []) as EventRow[];
      out.push(...rows.map((r) => ({ occurredAt: r.occurred_at, name: r.name, visitor: r.visitor, source: r.source, device: r.device, region: r.region })));
      if (rows.length < 1000 || out.length >= 50_000) break;
    }
    return out;
  }

  async setStatus(id: string, status: WaitlistStatus) {
    const db = await supabaseServer();
    const { error } = await db.from('waitlist').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async recordVitals(page: PageGroup, device: Device, metrics: { name: MetricName; value: number }[]) {
    const db = await supabaseServer();
    const { error } = await db.rpc('record_web_vitals', { page, kind_of_device: device, items: metrics });
    if (error && !missing(error)) console.error('[site] record_web_vitals failed: %s', error.message);
  }

  async recordAppOpen(_userId: string, installed: boolean, device: Device) {
    // The database takes the coach from the session (auth.uid()), not from the caller.
    const db = await supabaseServer();
    const { error } = await db.rpc('record_app_open', { installed, kind_of_device: device });
    if (error && !missing(error)) console.error('[site] record_app_open failed: %s', error.message);
  }

  async vitals(sinceIso: string) {
    const db = await supabaseServer();
    const out: Vital[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from('web_vitals').select('occurred_at, metric, value, page, device').gte('occurred_at', sinceIso).order('occurred_at').range(from, from + 999);
      if (error) throw new Error(missing(error) ? 'usage-migration-missing' : error.message);
      const rows = (data ?? []) as { occurred_at: string; metric: Vital['metric']; value: number; page: Vital['page']; device: Vital['device'] }[];
      out.push(...rows.map((r) => ({ occurredAt: r.occurred_at, metric: r.metric, value: Number(r.value), page: r.page, device: r.device })));
      if (rows.length < 1000 || out.length >= 50_000) break;
    }
    return out;
  }

  async usage(sinceIso: string) {
    const db = await supabaseServer();
    const { data, error } = await db.rpc('app_usage', { since: sinceIso });
    if (error) throw new Error(missing(error) ? 'usage-migration-missing' : error.message);
    return data as UsageRows;
  }
}
