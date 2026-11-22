import 'server-only';
import { randomUUID } from 'node:crypto';
import { supabaseServer } from '../supabase/server';
import { OPTED_OUT, draftSchema, type Age, type Broadcast, type Draft, type Recipient, type Segment, type SendCounts, type Stats, type Status } from './schema';
import type { BroadcastStore, Queued } from './store';
import { logError } from '@/lib/errors';

type Err = { code?: string; message: string };
const missing = (e: Err) => e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42P01' || e.code === '42883' || /does not exist|could not find the (function|table)|schema cache/i.test(e.message);
const fail = (e: Err): never => {
  throw new Error(missing(e) ? 'broadcasts-migration-missing' : e.message);
};

type Row = {
  id: string; subject: string; preheader: string; greeting: boolean; blocks: unknown; segment: Segment; age_group: Age | null;
  status: Status; recipients: number; created_at: string; updated_at: string; sent_at: string | null; ref?: string | null;
};
const BASE = 'id, subject, preheader, greeting, blocks, segment, age_group, status, recipients, created_at, updated_at, sent_at';
const COLS = `${BASE}, ref`;
// Before 20261124000000_email_attribution.sql there's no ref column: read without it so Send keeps working.
const noRef = (e: Err) => e.code === '42703' || /column .*ref.* does not exist/i.test(e.message);
const BUCKET = 'email-images';

function toBroadcast(r: Row): Broadcast {
  // A stored body that no longer parses (an older block shape) shows as empty rather than breaking the page.
  const parsed = draftSchema.safeParse({ subject: r.subject, preheader: r.preheader, greeting: r.greeting, blocks: r.blocks, segment: r.segment, ageGroup: r.age_group });
  const d: Draft = parsed.success ? parsed.data : { subject: r.subject, preheader: r.preheader, greeting: r.greeting, blocks: [], segment: r.segment, ageGroup: r.age_group };
  return { ...d, id: r.id, ref: r.ref ?? null, status: r.status, recipients: r.recipients, createdAt: r.created_at, updatedAt: r.updated_at, sentAt: r.sent_at };
}

export class SupabaseBroadcastStore implements BroadcastStore {
  async list() {
    const db = await supabaseServer();
    let { data, error } = (await db.from('broadcasts').select(COLS).order('created_at', { ascending: false })) as { data: unknown[] | null; error: Err | null };
    if (error && noRef(error)) ({ data, error } = await db.from('broadcasts').select(BASE).order('created_at', { ascending: false }));
    if (error) fail(error);
    return ((data ?? []) as Row[]).map(toBroadcast);
  }

  async get(id: string) {
    const db = await supabaseServer();
    let { data, error } = (await db.from('broadcasts').select(COLS).eq('id', id).maybeSingle()) as { data: unknown; error: Err | null };
    if (error && noRef(error)) ({ data, error } = await db.from('broadcasts').select(BASE).eq('id', id).maybeSingle());
    if (error) fail(error);
    return data ? toBroadcast(data as Row) : null;
  }

  async create() {
    const { data, error } = await (await supabaseServer()).from('broadcasts').insert({ blocks: [{ type: 'text', text: '' }] }).select('id').single();
    if (error) fail(error);
    return (data as { id: string }).id;
  }

  async save(id: string, d: Draft) {
    const { data, error } = await (await supabaseServer())
      .from('broadcasts')
      .update({ subject: d.subject, preheader: d.preheader, greeting: d.greeting, blocks: d.blocks, segment: d.segment, age_group: d.segment === 'age' ? d.ageGroup : null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'draft')
      .select('id');
    if (error) fail(error);
    return (data ?? []).length > 0;
  }

  async remove(id: string) {
    const { data, error } = await (await supabaseServer()).from('broadcasts').delete().eq('id', id).eq('status', 'draft').select('id');
    if (error) fail(error);
    return (data ?? []).length > 0;
  }

  async recipients(segment: Segment, age: Age | null): Promise<Recipient[]> {
    const { data, error } = await (await supabaseServer()).rpc('broadcast_recipients', { seg: segment, age: segment === 'age' ? age : null });
    if (error) fail(error);
    return ((data ?? []) as { person_id: string; email: string; first_name: string | null; team_name: string | null; unsubscribe_token: string }[]).map((r) => ({
      personId: r.person_id, email: r.email, firstName: r.first_name, teamName: r.team_name, unsubscribeToken: r.unsubscribe_token,
    }));
  }

  async start(id: string, expected: number) {
    const { data, error } = await (await supabaseServer()).rpc('start_broadcast', { b: id, expected });
    if (error) {
      const changed = error.message.match(/list-changed:(\d+)/);
      if (changed) throw new Error(`list-changed:${changed[1]}`);
      if (/list-empty/.test(error.message)) throw new Error('list-empty');
      fail(error);
    }
    return typeof data === 'number' ? data : 0;
  }

  async queued(id: string, limit: number): Promise<Queued[]> {
    const { data, error } = await (await supabaseServer())
      .from('broadcast_sends')
      .select('id, person_id, email, first_name, research_people(unsubscribe_token, updates_off_at, unsubscribed_at)')
      .eq('broadcast_id', id)
      .eq('status', 'queued')
      .order('email')
      .limit(limit);
    if (error) fail(error);
    type P = { unsubscribe_token: string; updates_off_at: string | null; unsubscribed_at: string | null };
    type Q = { id: string; person_id: string; email: string; first_name: string | null; research_people: P | P[] | null };
    return ((data ?? []) as unknown as Q[]).map((r) => {
      const p = Array.isArray(r.research_people) ? r.research_people[0] : r.research_people;
      return { sendId: r.id, personId: r.person_id, email: r.email, firstName: r.first_name, unsubscribeToken: p?.unsubscribe_token ?? '', optedOut: !p || Boolean(p.updates_off_at || p.unsubscribed_at) };
    });
  }

  async mark(sendIds: string[], outcome: { sent: true } | { sent: false; error: string }) {
    if (!sendIds.length) return;
    const patch = outcome.sent ? { status: 'sent', sent_at: new Date().toISOString(), error: null } : { status: 'failed', error: outcome.error.slice(0, 300) };
    const { error } = await (await supabaseServer()).from('broadcast_sends').update(patch).in('id', sendIds);
    if (error) fail(error);
  }

  async finish(id: string) {
    const db = await supabaseServer();
    const { count, error } = await db.from('broadcast_sends').select('id', { count: 'exact', head: true }).eq('broadcast_id', id).eq('status', 'queued');
    if (error) fail(error);
    if (!count) {
      const { error: e } = await db.from('broadcasts').update({ status: 'sent' }).eq('id', id).eq('status', 'sending');
      if (e) fail(e);
    }
  }

  async counts(id: string): Promise<SendCounts> {
    const { data, error } = await (await supabaseServer()).from('broadcast_sends').select('status, error').eq('broadcast_id', id);
    if (error) fail(error);
    const rows = (data ?? []) as { status: 'queued' | 'sent' | 'failed'; error: string | null }[];
    const skipped = rows.filter((r) => r.status === 'failed' && r.error === OPTED_OUT).length;
    return { queued: rows.filter((r) => r.status === 'queued').length, sent: rows.filter((r) => r.status === 'sent').length, failed: rows.filter((r) => r.status === 'failed').length - skipped, skipped };
  }

  async uploadImage(type: string, bytes: ArrayBuffer) {
    const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' } as Record<string, string>)[type] ?? 'bin';
    const path = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;
    const db = await supabaseServer();
    const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: type, cacheControl: '31536000', upsert: false });
    if (error) throw new Error(/bucket not found/i.test(error.message) ? 'broadcasts-migration-missing' : error.message);
    return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async stats(id: string): Promise<Stats | null> {
    const { data, error } = await (await supabaseServer()).rpc('broadcast_stats', { b: id });
    if (error) {
      if (missing(error)) return null;
      fail(error);
    }
    return data as Stats;
  }

  async recordClick(ref: string, link: number): Promise<'stored' | 'ignored' | 'signed-out'> {
    const db = await supabaseServer();
    const { data: u } = await db.auth.getUser();
    if (!u.user) return 'signed-out';
    const { data, error } = await db.rpc('record_email_click', { ref, link });
    if (error) {
      logError('[email-click] %s', error.message);
      return 'ignored';
    }
    return data === true ? 'stored' : 'ignored';
  }

  async updatesStatus(token: string) {
    const { data, error } = await (await supabaseServer()).rpc('updates_status', { t: token });
    if (error) return null;
    return typeof data === 'boolean' ? data : null;
  }

  async updatesOff(token: string) {
    const { data, error } = await (await supabaseServer()).rpc('updates_off', { t: token });
    if (error) throw new Error(error.message);
    return data === true;
  }
}
