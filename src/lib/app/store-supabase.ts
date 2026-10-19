import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseServer } from '../supabase/server';
import { attendanceSchema, blockSchema, practiceSchema, teamSchema, type Practice, type Team } from '../plans/schema';
import { drillSchema, type Drill } from '../drills/schema';
import type { PracticeActivity, Snapshot } from '../plans/activity';
import { checkinInput, type Checkin } from '../plans/checkin';
import { newShareToken, type AppStore, type IceTime, type IceTimeRow, type NewPractice, type Share, type SharedPractice, type TeamCoach, type Favorite } from './store';

// Every query runs as the signed-in coach, so RLS limits it to their own team.

type TeamRow = { id: string; name: string; age_group: string; groups: Team['groups']; coaches_on_ice: number; practice_minutes: number; ice: Team['ice']; new_drills_per_week: number };
type PracticeRow = { id: string; team_id: string; date: string; start_time: string; minutes: number; ice: Practice['ice']; status: Practice['status']; blocks: Practice['blocks']; attendance?: Practice['attendance'] };

const toTeam = (r: TeamRow): Team =>
  teamSchema.parse({ id: r.id, name: r.name, ageGroup: r.age_group, groups: r.groups, coachesOnIce: r.coaches_on_ice, practiceMinutes: r.practice_minutes, ice: r.ice, newDrillsPerWeek: r.new_drills_per_week });
const toPractice = (r: PracticeRow): Practice =>
  practiceSchema.parse({ id: r.id, teamId: r.team_id, date: r.date, startTime: r.start_time.slice(0, 5), minutes: r.minutes, ice: r.ice, status: r.status, blocks: r.blocks, attendance: r.attendance ?? null });

export class SupabaseAppStore implements AppStore {
  async myTeam(userId: string) {
    const db = await supabaseServer();
    const { data } = await db.from('team_members').select('teams(*)').eq('user_id', userId).order('created_at').limit(1).maybeSingle();
    const row = (data as { teams: TeamRow | null } | null)?.teams;
    return row ? toTeam(row) : null;
  }
  async createTeam(name: string) {
    const db = await supabaseServer();
    const { data: id, error } = await db.rpc('create_team', { team_name: name });
    if (error) throw error;
    const { data, error: e2 } = await db.from('teams').select('*').eq('id', id).single();
    if (e2) throw e2;
    return toTeam(data as TeamRow);
  }
  async updateTeam(t: Team) {
    const db = await supabaseServer();
    const { error } = await db
      .from('teams')
      .update({ name: t.name, groups: t.groups, coaches_on_ice: t.coachesOnIce, practice_minutes: t.practiceMinutes, ice: t.ice, new_drills_per_week: t.newDrillsPerWeek })
      .eq('id', t.id);
    if (error) throw error;
  }
  async listPractices(teamId: string) {
    const db = await supabaseServer();
    const { data, error } = await db.from('practices').select('*').eq('team_id', teamId).order('date', { ascending: false }).order('start_time', { ascending: false });
    if (error) throw error;
    return (data as PracticeRow[]).map(toPractice);
  }
  async getPractice(id: string) {
    const db = await supabaseServer();
    const { data } = await db.from('practices').select('*').eq('id', id).maybeSingle();
    return data ? toPractice(data as PracticeRow) : null;
  }
  async createPractice(p: NewPractice, userId: string) {
    const db = await supabaseServer();
    const { data, error } = await db
      .from('practices')
      .insert({ team_id: p.teamId, date: p.date, start_time: p.startTime, minutes: p.minutes, ice: p.ice, status: p.status, blocks: p.blocks, created_by: userId })
      .select('*')
      .single();
    if (error) throw error;
    return toPractice(data as PracticeRow);
  }
  async savePractice(p: Practice) {
    const db = await supabaseServer();
    const row = { date: p.date, start_time: p.startTime, minutes: p.minutes, ice: p.ice, status: p.status, blocks: p.blocks, attendance: p.attendance, updated_at: new Date().toISOString() };
    let { error } = await db.from('practices').update(row).eq('id', p.id);
    if (error && /attendance/.test(error.message)) {
      // The attendance migration hasn't run yet: save the plan anyway, without today's groups.
      console.error('[store] practices.attendance missing; run supabase/migrations/20261015000000_attendance.sql');
      const { attendance: _skip, ...rest } = row;
      void _skip;
      ({ error } = await db.from('practices').update(rest).eq('id', p.id));
    }
    if (error) throw error;
  }
  async deletePractice(id: string) {
    const db = await supabaseServer();
    const { error } = await db.from('practices').delete().eq('id', id);
    if (error) throw error;
  }
  async libraryDrills(): Promise<Drill[]> {
    const db = await supabaseServer();
    const { data, error } = await db.from('drills').select('id, status, content').eq('status', 'live').order('id');
    if (error) throw error;
    return (data ?? []).flatMap((r) => {
      const parsed = drillSchema.safeParse({ ...r.content, id: r.id, status: r.status });
      return parsed.success ? [parsed.data] : [];
    });
  }

  async activeShare(practiceId: string): Promise<Share | null> {
    const db = await supabaseServer();
    const { data } = await db
      .from('practice_shares')
      .select('token, expires_at')
      .eq('practice_id', practiceId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? { token: data.token, expiresAt: data.expires_at } : null;
  }
  async createShare(practiceId: string, teamId: string, userId: string): Promise<Share> {
    const db = await supabaseServer();
    const { data, error } = await db.from('practice_shares').insert({ token: newShareToken(), practice_id: practiceId, team_id: teamId, created_by: userId }).select('token, expires_at').single();
    if (error) throw error;
    return { token: data.token, expiresAt: data.expires_at };
  }
  async revokeShares(practiceId: string) {
    const db = await supabaseServer();
    const { error } = await db.from('practice_shares').update({ revoked_at: new Date().toISOString() }).eq('practice_id', practiceId).is('revoked_at', null);
    if (error) throw error;
  }
  async sharedPractice(token: string): Promise<SharedPractice | null> {
    // Anonymous on purpose: parents have no account. The SQL function decides what they may see.
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { data, error } = await anon.rpc('shared_practice', { link: token });
    if (error || !data) return null;
    const r = data as { team: string; groups?: unknown; practice: { date: string; start_time: string; minutes: number; ice: 'half' | 'full'; blocks: unknown[]; attendance?: unknown }; drills: { id: string; content: Record<string, unknown> }[] };
    const blocks = r.practice.blocks.flatMap((b) => {
      const x = blockSchema.safeParse(b);
      return x.success ? [x.data] : [];
    });
    const drills = r.drills.flatMap((d) => {
      const x = drillSchema.safeParse({ ...d.content, id: d.id, status: 'live' });
      return x.success ? [x.data] : [];
    });
    const attendance = attendanceSchema.safeParse(r.practice.attendance);
    const groups = teamSchema.shape.groups.safeParse(r.groups);
    return {
      team: r.team,
      groups: groups.success ? groups.data : null,
      practice: { date: r.practice.date, startTime: r.practice.start_time.slice(0, 5), minutes: r.practice.minutes, ice: r.practice.ice, blocks, attendance: attendance.success ? attendance.data : null },
      drills,
    };
  }

  async calendar(teamId: string) {
    const db = await supabaseServer();
    const { data, error } = await db.from('teams').select('calendar_url, calendar_synced_at').eq('id', teamId).maybeSingle();
    if (error || !data?.calendar_url) return null; // also when the calendar migration hasn't run
    return { url: data.calendar_url as string, syncedAt: (data.calendar_synced_at as string | null) ?? null };
  }
  async setCalendar(teamId: string, url: string | null) {
    const db = await supabaseServer();
    const { data, error } = await db.from('teams').update({ calendar_url: url, calendar_synced_at: null }).eq('id', teamId).select('id');
    if (error) throw new Error(/calendar_url|column|schema cache/i.test(error.message) ? 'calendar-migration-missing' : error.message);
    // RLS lets only the head coach update the team; anyone else updates no rows.
    if (!data?.length) throw new Error('not-head-coach');
    if (!url) await db.from('ice_times').delete().eq('team_id', teamId).is('practice_id', null);
  }
  async markCalendarSynced(teamId: string, at: string) {
    const db = await supabaseServer();
    // Only the head coach may update the team row; for other coaches the sync still happened.
    await db.from('teams').update({ calendar_synced_at: at }).eq('id', teamId);
  }
  async iceTimes(teamId: string): Promise<IceTime[]> {
    const db = await supabaseServer();
    const { data, error } = await db.from('ice_times').select('*').eq('team_id', teamId).order('date').order('start_time');
    if (error) return [];
    return (data ?? []).map((r) => ({
      id: r.id,
      teamId: r.team_id,
      uid: r.uid,
      date: r.date,
      startTime: String(r.start_time).slice(0, 5),
      minutes: r.minutes,
      title: r.title,
      rink: r.rink,
      kind: r.kind,
      sharedWith: r.shared_with,
      cancelled: r.cancelled,
      ignored: r.ignored,
      practiceId: r.practice_id,
      movedFrom: r.moved_from,
    }));
  }
  async upsertIceTimes(teamId: string, rows: IceTimeRow[]) {
    if (!rows.length) return;
    const db = await supabaseServer();
    const { error } = await db.from('ice_times').upsert(
      rows.map((r) => ({
        team_id: teamId,
        uid: r.uid,
        date: r.date,
        start_time: r.startTime,
        minutes: r.minutes,
        title: r.title,
        rink: r.rink,
        kind: r.kind,
        shared_with: r.sharedWith,
        cancelled: r.cancelled,
        ignored: r.ignored,
        practice_id: r.practiceId,
        moved_from: r.movedFrom,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'team_id,uid' },
    );
    if (error) throw error;
  }
  async setIceTime(id: string, patch: { ignored?: boolean; practiceId?: string | null }) {
    const db = await supabaseServer();
    const row: Record<string, unknown> = {};
    if (patch.ignored !== undefined) row.ignored = patch.ignored;
    if (patch.practiceId !== undefined) row.practice_id = patch.practiceId;
    const { error } = await db.from('ice_times').update(row).eq('id', id);
    if (error) throw error;
  }

  // The activity log is extra: if its migration hasn't run, plans still save and the list still shows.
  async latestEdit(practiceId: string) {
    const db = await supabaseServer();
    const { data, error } = await db.from('practice_edits').select('id, user_id, at, base').eq('practice_id', practiceId).order('at', { ascending: false }).limit(1).maybeSingle();
    if (error || !data) return null;
    return { id: data.id as string, userId: data.user_id as string | null, at: data.at as string, base: (data.base as Snapshot | null) ?? null };
  }
  async addEdit(e: { practiceId: string; teamId: string; userId: string; editor: string; summary: string; base: Snapshot | null }) {
    const db = await supabaseServer();
    const { error } = await db.from('practice_edits').insert({ practice_id: e.practiceId, team_id: e.teamId, user_id: e.userId, editor: e.editor, summary: e.summary, base: e.base });
    if (error) console.error('[store] practice_edits:', error.message);
  }
  async updateEdit(id: string, patch: { summary: string; at: string }) {
    const db = await supabaseServer();
    const { error } = await db.from('practice_edits').update(patch).eq('id', id);
    if (error) console.error('[store] practice_edits:', error.message);
  }
  async markViewed(practiceId: string, userId: string) {
    const db = await supabaseServer();
    const { error } = await db.from('practice_views').upsert({ practice_id: practiceId, user_id: userId, viewed_at: new Date().toISOString() });
    if (error) console.error('[store] practice_views:', error.message);
  }
  async teamActivity(teamId: string, userId: string) {
    const db = await supabaseServer();
    const [{ data: edits, error }, { data: views }] = await Promise.all([
      db.from('practice_edits').select('practice_id, user_id, editor, summary, at').eq('team_id', teamId).order('at', { ascending: false }).limit(500),
      db.from('practice_views').select('practice_id, viewed_at').eq('user_id', userId),
    ]);
    const out: Record<string, PracticeActivity> = {};
    if (error) return out;
    const seen = new Map((views ?? []).map((v) => [v.practice_id as string, v.viewed_at as string]));
    for (const e of edits ?? [])
      (out[e.practice_id] ??= { edits: [], viewedAt: seen.get(e.practice_id) ?? null }).edits.push({ userId: e.user_id, editor: e.editor, summary: e.summary, at: e.at });
    return out;
  }

  // Check-ins: if the migration hasn't run, reads come back empty and a save explains what to run.
  async teamCheckins(teamId: string) {
    const db = await supabaseServer();
    const { data, error } = await db.from('practice_checkins').select('*').eq('team_id', teamId);
    if (error || !data) return [];
    return data.map((r): Checkin => ({
      ...checkinInput.parse({ overall: r.overall, steam: r.steam, steamFrom: r.steam_from, ready: r.ready ?? [], note: r.note ?? '', marks: r.marks ?? [] }),
      practiceId: r.practice_id, teamId: r.team_id, userId: r.user_id, editor: r.editor, savedAt: r.saved_at,
    }));
  }
  async saveCheckin(c: Checkin) {
    const db = await supabaseServer();
    const { error } = await db.from('practice_checkins').upsert({
      practice_id: c.practiceId, team_id: c.teamId, user_id: c.userId, editor: c.editor,
      overall: c.overall, steam: c.steam, steam_from: c.steamFrom, ready: c.ready, note: c.note, marks: c.marks, saved_at: c.savedAt,
    });
    if (error) throw new Error(/practice_checkins/.test(error.message) ? 'Check-ins need a one-time database update (supabase/migrations/20261019000000_checkins.sql).' : error.message);
  }
  async coachCount(teamId: string) {
    const db = await supabaseServer();
    const { count } = await db.from('team_members').select('user_id', { count: 'exact', head: true }).eq('team_id', teamId);
    return Math.max(1, count ?? 1);
  }

  async checkinEmails(teamId: string, userId: string) {
    const db = await supabaseServer();
    const { data, error } = await db.from('team_members').select('checkin_emails').eq('team_id', teamId).eq('user_id', userId).maybeSingle();
    if (error || !data) return true; // also before the email migration has run
    return (data as { checkin_emails: boolean }).checkin_emails;
  }
  async setCheckinEmails(teamId: string, _userId: string, on: boolean) {
    const db = await supabaseServer();
    const { error } = await db.rpc('set_checkin_emails', { team: teamId, wanted: on });
    if (error) throw new Error(/set_checkin_emails|function|schema cache/i.test(error.message) ? 'email-migration-missing' : error.message);
  }

  async coaches(teamId: string): Promise<TeamCoach[]> {
    const db = await supabaseServer();
    const { data, error } = await db.rpc('team_coaches', { team: teamId });
    if (error) return []; // also before the join-link migration has run
    return ((data ?? []) as { user_id: string; email: string; role: TeamCoach['role']; joined_at: string }[]).map((r) => ({ userId: r.user_id, email: r.email, role: r.role, joinedAt: r.joined_at }));
  }
  async joinCode(teamId: string) {
    const db = await supabaseServer();
    const { data, error } = await db.from('teams').select('join_code').eq('id', teamId).maybeSingle();
    if (error || !data) return null;
    return (data as { join_code: string | null }).join_code;
  }
  async newJoinCode(teamId: string) {
    const db = await supabaseServer();
    const { data, error } = await db.rpc('new_join_code', { team: teamId });
    if (error) throw new Error(joinError(error.message));
    return data as string;
  }
  async turnOffJoinCode(teamId: string) {
    const db = await supabaseServer();
    const { error } = await db.rpc('turn_off_join_code', { team: teamId });
    if (error) throw new Error(joinError(error.message));
  }
  async joinCodeTeam(code: string) {
    const db = await supabaseServer();
    const { data, error } = await db.rpc('join_code_team', { code });
    const row = (data as { team_id: string; team_name: string }[] | null)?.[0];
    if (error || !row) return null;
    return { id: row.team_id, name: row.team_name };
  }
  async joinTeam(code: string) {
    const db = await supabaseServer();
    const { data, error } = await db.rpc('join_team', { code });
    if (error) throw new Error(joinError(error.message));
    return data as string;
  }
  async removeCoach(teamId: string, userId: string) {
    const db = await supabaseServer();
    const { error } = await db.rpc('remove_coach', { team: teamId, coach: userId });
    if (error) throw new Error(joinError(error.message));
  }
  async favorites(teamId: string): Promise<Record<string, Favorite>> {
    const db = await supabaseServer();
    const { data, error } = await db.from('team_favorites').select('drill_id, editor, created_at').eq('team_id', teamId);
    if (error) return {}; // also before the favourites migration has run
    return Object.fromEntries(((data ?? []) as { drill_id: string; editor: string; created_at: string }[]).map((r) => [r.drill_id, { by: r.editor, at: r.created_at }]));
  }
  async setFavorite(teamId: string, userId: string, editor: string, drillId: string, on: boolean) {
    const db = await supabaseServer();
    const { error } = on
      ? await db.from('team_favorites').upsert({ team_id: teamId, drill_id: drillId, user_id: userId, editor: editor.slice(0, 60) }, { onConflict: 'team_id,drill_id', ignoreDuplicates: true })
      : await db.from('team_favorites').delete().eq('team_id', teamId).eq('drill_id', drillId);
    if (error) throw new Error(/team_favorites|relation|schema cache/i.test(error.message) ? 'favorites-migration-missing' : error.message);
  }
}

function joinError(message: string): string {
  for (const known of ['link-off', 'on-another-team', 'not-head-coach', 'not-yourself']) if (message.includes(known)) return known;
  if (/function|schema cache|join_code/i.test(message)) return 'join-migration-missing';
  return message;
}
