import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseServer } from '../supabase/server';
import { attendanceSchema, blockSchema, practiceSchema, teamSchema, type Practice, type Team } from '../plans/schema';
import { drillSchema, type Drill } from '../drills/schema';
import { newShareToken, type AppStore, type IceTime, type IceTimeRow, type NewPractice, type Share, type SharedPractice } from './store';

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
    const { error } = await db.from('teams').update({ calendar_url: url, calendar_synced_at: null }).eq('id', teamId);
    if (error) throw error;
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
}
