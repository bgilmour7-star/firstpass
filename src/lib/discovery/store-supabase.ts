import 'server-only';
import { supabaseServer } from '../supabase/server';
import type { Audience, CallStatus, GiftCard, Invite, Note, NoteKind, Person, SendStats, SurveyResponse, Usage } from './schema';
import type { DiscoveryStore, SubmitResult, ThemeTarget } from './store';

type Err = { code?: string; message: string };
const missing = (e: Err) => e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42P01' || e.code === '42883' || /does not exist|could not find the (function|table)|schema cache/i.test(e.message);
const fail = (e: Err): never => {
  throw new Error(missing(e) ? 'discovery-migration-missing' : e.message);
};

type PersonRow = { id: string; code: string; email: string; first_name: string | null; audience: Audience; user_id: string | null; waitlist_id: string | null; unsubscribed_at: string | null; created_at: string };
type ResponseRow = {
  id: string; person_id: string; audience: SurveyResponse['audience']; role: string | null; age_groups: string[]; planned_how: string | null; planned_when: string | null;
  hardest_part: string | null; wants_help: string | null; extra: SurveyResponse['extra'] | null; wants_call: boolean; call_times: string[]; phone: string | null;
  call_status: CallStatus; gift_card: GiftCard; themes: string[]; created_at: string;
};
type OlderRow = { id: string; user_id: string; age_group: string | null; hardest_part: string | null; wants_call: boolean | null; created_at: string };
type UsageRow = { person_id: string; teams: Usage['teams']; practices_run: number; checkins: number; swaps: number; last_active: string | null };

const PERSON = 'id, code, email, first_name, audience, user_id, waitlist_id, unsubscribed_at, created_at';
const RESPONSE = 'id, person_id, audience, role, age_groups, planned_how, planned_when, hardest_part, wants_help, extra, wants_call, call_times, phone, call_status, gift_card, themes, created_at';

export class SupabaseDiscoveryStore implements DiscoveryStore {
  async invite(token: string): Promise<Invite | null> {
    const { data, error } = await (await supabaseServer()).rpc('survey_invite', { t: token });
    if (error) {
      if (!missing(error)) console.error('[survey] invite lookup failed: %s', error.message);
      return null;
    }
    const r = (data as { audience: Audience; first_name: string | null; email: string; used: boolean; team_name: string | null }[] | null)?.[0];
    return r ? { audience: r.audience, firstName: r.first_name, email: r.email, used: r.used, teamName: r.team_name } : null;
  }

  async submit(token: string, row: Record<string, unknown>): Promise<SubmitResult> {
    const { data, error } = await (await supabaseServer()).rpc('submit_survey', { t: token, answers: row });
    if (error) throw new Error(error.message);
    return (data as SubmitResult) ?? 'unknown';
  }

  async unsubscribeStatus(token: string) {
    const { data, error } = await (await supabaseServer()).rpc('unsubscribe_status', { t: token });
    if (error) return null;
    const r = (data as { audience: Audience; unsubscribed: boolean }[] | null)?.[0];
    return r ?? null;
  }

  async unsubscribe(token: string) {
    const { data, error } = await (await supabaseServer()).rpc('unsubscribe', { t: token });
    if (error) throw new Error(error.message);
    return data === true;
  }

  async people(): Promise<Person[]> {
    const { data, error } = await (await supabaseServer()).from('research_people').select(PERSON).order('created_at', { ascending: false });
    if (error) fail(error);
    return ((data ?? []) as PersonRow[]).map((r) => ({ id: r.id, code: r.code, email: r.email, firstName: r.first_name, audience: r.audience, userId: r.user_id, waitlistId: r.waitlist_id, unsubscribedAt: r.unsubscribed_at, createdAt: r.created_at }));
  }

  async responses(): Promise<SurveyResponse[]> {
    const db = await supabaseServer();
    const { data, error } = await db.from('survey_responses').select(RESPONSE).order('created_at', { ascending: false });
    if (error) fail(error);
    const out: SurveyResponse[] = ((data ?? []) as ResponseRow[]).map((r) => ({
      id: r.id, personId: r.person_id, audience: r.audience, role: r.role, ageGroups: r.age_groups ?? [], plannedHow: r.planned_how, plannedWhen: r.planned_when,
      hardestPart: r.hardest_part, wantsHelp: r.wants_help, extra: r.extra ?? {}, wantsCall: r.wants_call, callTimes: r.call_times ?? [], phone: r.phone,
      callStatus: r.call_status, giftCard: r.gift_card, themes: r.themes ?? [], createdAt: r.created_at,
    }));
    // U11+ coaches from the create-a-team wizard (PR 2). Before that table exists there are none.
    const older = await db.from('older_team_interest').select('id, user_id, age_group, hardest_part, wants_call, created_at');
    if (!older.error && older.data?.length) {
      const people = await db.from('research_people').select('id, user_id').not('user_id', 'is', null);
      const byUser = new Map(((people.data ?? []) as { id: string; user_id: string }[]).map((p) => [p.user_id, p.id]));
      for (const o of older.data as OlderRow[]) {
        const personId = byUser.get(o.user_id);
        if (!personId) continue;
        out.push({
          id: `older-${o.id}`, personId, audience: 'older', role: null, ageGroups: o.age_group ? [o.age_group] : ['U11+'], plannedHow: null, plannedWhen: null,
          hardestPart: o.hardest_part, wantsHelp: null, extra: {}, wantsCall: o.wants_call === true, callTimes: [], phone: null,
          callStatus: o.wants_call ? 'to_book' : 'none', giftCard: 'not_offered', themes: [], createdAt: o.created_at, readOnly: true,
        });
      }
      out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else if (older.error && !missing(older.error)) {
      console.error('[discovery] older_team_interest read failed: %s', older.error.message);
    }
    return out;
  }

  async notes(personId?: string): Promise<Note[]> {
    let q = (await supabaseServer()).from('coach_notes').select('id, person_id, kind, body, themes, created_at').order('created_at', { ascending: false });
    if (personId) q = q.eq('person_id', personId);
    const { data, error } = await q;
    if (error) fail(error);
    return ((data ?? []) as { id: string; person_id: string; kind: NoteKind; body: string; themes: string[]; created_at: string }[]).map((r) => ({ id: r.id, personId: r.person_id, kind: r.kind, body: r.body, themes: r.themes ?? [], createdAt: r.created_at }));
  }

  async addNote(personId: string, kind: NoteKind, body: string) {
    const { error } = await (await supabaseServer()).from('coach_notes').insert({ person_id: personId, kind, body });
    if (error) fail(error);
  }

  async setCallStatus(responseId: string, status: CallStatus) {
    const { error } = await (await supabaseServer()).from('survey_responses').update({ call_status: status }).eq('id', responseId);
    if (error) fail(error);
  }

  async setGiftCard(responseId: string, card: GiftCard) {
    const { error } = await (await supabaseServer()).from('survey_responses').update({ gift_card: card }).eq('id', responseId);
    if (error) fail(error);
  }

  async setThemes(target: ThemeTarget, themes: string[]) {
    const db = await supabaseServer();
    const table = target.kind === 'response' ? 'survey_responses' : 'coach_notes';
    const { error } = await db.from(table).update({ themes }).eq('id', target.id);
    if (error) fail(error);
    // A theme Brett types himself is approved by typing it: add it to the list the daily task picks from.
    if (themes.length) {
      const { error: e2 } = await db.from('insight_themes').upsert(themes.map((name) => ({ name })), { onConflict: 'name', ignoreDuplicates: true });
      if (e2) console.error('[discovery] adding themes failed: %s', e2.message);
    }
  }

  async themes() {
    const { data, error } = await (await supabaseServer()).from('insight_themes').select('name').order('name');
    if (error) fail(error);
    return ((data ?? []) as { name: string }[]).map((r) => r.name);
  }

  async usage(): Promise<Usage[]> {
    const { data, error } = await (await supabaseServer()).rpc('discovery_usage');
    if (error) fail(error);
    return ((data ?? []) as UsageRow[]).map((r) => ({ personId: r.person_id, teams: r.teams ?? [], practicesRun: r.practices_run, checkins: r.checkins, swaps: r.swaps, lastActive: r.last_active }));
  }

  async sendStats(sinceIso: string): Promise<SendStats> {
    const { data, error } = await (await supabaseServer()).from('email_sends').select('journey, step, sent_at, skipped_reason').gte('created_at', sinceIso);
    if (error) fail(error);
    const map = new Map<string, SendStats[number]>();
    for (const r of (data ?? []) as { journey: string; step: string; sent_at: string | null; skipped_reason: string | null }[]) {
      const k = `${r.journey}.${r.step}`;
      const s = map.get(k) ?? { journey: r.journey, step: r.step, sent: 0, skipped: 0, queued: 0 };
      if (r.sent_at) s.sent++;
      else if (r.skipped_reason) s.skipped++;
      else s.queued++;
      map.set(k, s);
    }
    return [...map.values()];
  }

  async surveyToken(personId: string) {
    const db = await supabaseServer();
    const { data: p } = await db.from('research_people').select('audience').eq('id', personId).maybeSingle();
    const { data, error } = await db.from('survey_invites').select('token, audience').eq('person_id', personId);
    if (error) fail(error);
    const rows = (data ?? []) as { token: string; audience: Audience }[];
    return (rows.find((r) => r.audience === (p as { audience: Audience } | null)?.audience) ?? rows[0])?.token ?? null;
  }
}
