import 'server-only';
import { supabaseServer } from '../supabase/server';
import { answersSchema, parseProposed, type DrillRequest, type RequestInput } from './schema';
import type { RequestStore } from './store';

// Every query runs as the signed-in user: coaches see their own team's requests, admins all.

type Row = {
  id: string;
  kind: DrillRequest['kind'];
  team_id: string;
  requested_by: string | null;
  requester_name: string | null;
  requester_email: string | null;
  drill_id: string | null;
  answers: unknown;
  description: string;
  link: string | null;
  state: DrillRequest['state'];
  proposed: unknown;
  claude_note: string | null;
  reason: string | null;
  created_at: string;
  drafted_at: string | null;
  decided_at: string | null;
  teams?: { name: string } | null;
};
const COLS =
  'id, kind, team_id, requested_by, requester_name, requester_email, drill_id, answers, description, link, state, proposed, claude_note, reason, created_at, drafted_at, decided_at, teams(name)';

const toRequest = (r: Row): DrillRequest => ({
  id: r.id,
  kind: r.kind,
  teamId: r.team_id,
  teamName: r.teams?.name ?? null,
  requestedBy: r.requested_by,
  requesterName: r.requester_name,
  requesterEmail: r.requester_email,
  drillId: r.drill_id,
  answers: answersSchema.catch({ focus: [] }).parse(r.answers ?? {}),
  description: r.description,
  link: r.link,
  state: r.state,
  proposed: parseProposed(r.proposed),
  claudeNote: r.claude_note,
  reason: r.reason,
  createdAt: r.created_at,
  draftedAt: r.drafted_at,
  decidedAt: r.decided_at,
});

// Before the SQL has run, the table doesn't exist: lists are empty and sending explains it.
const missing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || (/drill_requests/.test(e.message ?? '') && /does not exist|schema cache/.test(e.message ?? '')));

export class SupabaseRequestStore implements RequestStore {
  async create(input: RequestInput, at: { teamId: string; userId: string; name: string; email: string }) {
    const db = await supabaseServer();
    const row = {
      kind: input.kind,
      team_id: at.teamId,
      requested_by: at.userId,
      requester_name: at.name.slice(0, 60),
      requester_email: at.email.slice(0, 254),
      drill_id: input.kind === 'change' ? input.drillId : null,
      answers: input.kind === 'new' ? input.answers : {},
      description: input.description,
      link: input.kind === 'new' ? input.link : null,
    };
    const { data, error } = await db.from('drill_requests').insert(row).select(COLS).single();
    if (error) {
      if (missing(error)) throw new Error('requests-migration-missing');
      if (error.code === '42501') {
        const { data: n } = await db.rpc('open_drill_requests', { t: at.teamId });
        if (typeof n === 'number' && n >= 5) throw new Error('request-limit');
      }
      throw error;
    }
    return toRequest(data as unknown as Row);
  }

  async forTeam(teamId: string) {
    const db = await supabaseServer();
    const { data, error } = await db.from('drill_requests').select(COLS).eq('team_id', teamId).order('created_at', { ascending: false }).limit(30);
    if (error) {
      if (missing(error)) return [];
      throw error;
    }
    return (data as unknown as Row[]).map(toRequest);
  }

  async all() {
    const db = await supabaseServer();
    const { data, error } = await db.from('drill_requests').select(COLS).order('created_at', { ascending: false }).limit(200);
    if (error) {
      if (missing(error)) return [];
      throw error;
    }
    return (data as unknown as Row[]).map(toRequest);
  }

  async get(id: string) {
    const db = await supabaseServer();
    const { data, error } = await db.from('drill_requests').select(COLS).eq('id', id).maybeSingle();
    if (error) {
      if (missing(error)) return null;
      throw error;
    }
    return data ? toRequest(data as unknown as Row) : null;
  }

  async decide(id: string, state: 'accepted' | 'declined', reason: string | null) {
    const before = await this.get(id);
    if (!before || (before.state !== 'sent' && before.state !== 'drafted')) return null;
    const db = await supabaseServer();
    const { error } = await db
      .from('drill_requests')
      .update({ state, reason, decided_at: new Date().toISOString() })
      .eq('id', id)
      .in('state', ['sent', 'drafted']);
    if (error) throw error;
    return before;
  }

  async markCoachEmailed(id: string) {
    const db = await supabaseServer();
    await db.from('drill_requests').update({ coach_emailed_at: new Date().toISOString() }).eq('id', id);
  }
}
