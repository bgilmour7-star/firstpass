import 'server-only';
import { supabaseServer } from '../supabase/server';
import { drillSchema, type DiagramRequest, type Drill, type ReviewNote, type Status } from './schema';
import type { DrillDetail, DrillStore, DrillSummary } from './store';

// Supabase store. Queries run as the signed-in user, so RLS (admins only) applies to each one.
// `actor` is the user id; the database records it as updated_by / created_by.

type Row = { id: string; status: Status; content: Drill; updated_at: string; updated_by: string | null };

function toDrill(r: Row): Drill {
  return drillSchema.parse({ ...r.content, id: r.id, status: r.status });
}

export class SupabaseDrillStore implements DrillStore {
  readonly kind = 'supabase' as const;

  async list(): Promise<DrillSummary[]> {
    const db = await supabaseServer();
    const [{ data: rows, error }, { data: open }] = await Promise.all([
      db.from('drills').select('id, status, content, updated_at, updated_by').order('id'),
      db.from('diagram_requests').select('drill_id').is('resolved_at', null),
    ]);
    if (error) throw error;
    return (rows as Row[]).map((r) => {
      const d = toDrill(r);
      return {
        id: d.id,
        funName: d.funName,
        plainName: d.plainName,
        status: d.status,
        groupModel: d.groupModel,
        minutes: d.minutes,
        diagram: d.diagram,
        openRequests: (open ?? []).filter((o) => o.drill_id === d.id).length,
        updatedAt: r.updated_at,
      };
    });
  }

  async get(id: string): Promise<DrillDetail | null> {
    const db = await supabaseServer();
    const { data: row } = await db.from('drills').select('id, status, content, updated_at, updated_by').eq('id', id).maybeSingle();
    if (!row) return null;
    const [{ data: reqs }, { data: notes }, { data: admins }] = await Promise.all([
      db.from('diagram_requests').select('*').eq('drill_id', id).order('created_at', { ascending: false }),
      db.from('review_notes').select('*').eq('drill_id', id).order('created_at', { ascending: false }),
      db.from('admins').select('user_id, email'),
    ]);
    const who = (uid: string | null) => admins?.find((a) => a.user_id === uid)?.email ?? 'Someone';
    return {
      drill: toDrill(row as Row),
      requests: (reqs ?? []).map(
        (r): DiagramRequest => ({ id: r.id, drillId: r.drill_id, note: r.note, createdBy: who(r.created_by), createdAt: r.created_at, resolvedAt: r.resolved_at, resolution: r.resolution }),
      ),
      notes: (notes ?? []).map((n): ReviewNote => ({ id: n.id, drillId: n.drill_id, body: n.body, createdBy: who(n.created_by), createdAt: n.created_at })),
      updatedAt: row.updated_at,
      updatedBy: who(row.updated_by),
    };
  }

  async save(drill: Drill, actor: string) {
    const d = drillSchema.parse(drill);
    const { id, status, ...content } = d;
    const db = await supabaseServer();
    const { error } = await db.from('drills').update({ content: { ...content, id }, status, updated_at: new Date().toISOString(), updated_by: actor }).eq('id', id);
    if (error) throw error;
  }

  async setStatus(id: string, status: Status, actor: string) {
    const db = await supabaseServer();
    const { error } = await db.from('drills').update({ status, updated_at: new Date().toISOString(), updated_by: actor }).eq('id', id);
    if (error) throw error;
  }

  async addDiagramRequest(drillId: string, note: string, actor: string) {
    const db = await supabaseServer();
    const { error } = await db.from('diagram_requests').insert({ drill_id: drillId, note, created_by: actor });
    if (error) throw error;
  }

  async addNote(drillId: string, body: string, actor: string) {
    const db = await supabaseServer();
    const { error } = await db.from('review_notes').insert({ drill_id: drillId, body, created_by: actor });
    if (error) throw error;
  }
}
