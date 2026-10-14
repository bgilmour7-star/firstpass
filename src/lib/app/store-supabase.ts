import 'server-only';
import { supabaseServer } from '../supabase/server';
import { practiceSchema, teamSchema, type Practice, type Team } from '../plans/schema';
import { drillSchema, type Drill } from '../drills/schema';
import type { AppStore, NewPractice } from './store';

// Every query runs as the signed-in coach, so RLS limits it to their own team.

type TeamRow = { id: string; name: string; age_group: string; groups: Team['groups']; coaches_on_ice: number; practice_minutes: number; ice: Team['ice']; new_drills_per_week: number };
type PracticeRow = { id: string; team_id: string; date: string; start_time: string; minutes: number; ice: Practice['ice']; status: Practice['status']; blocks: Practice['blocks'] };

const toTeam = (r: TeamRow): Team =>
  teamSchema.parse({ id: r.id, name: r.name, ageGroup: r.age_group, groups: r.groups, coachesOnIce: r.coaches_on_ice, practiceMinutes: r.practice_minutes, ice: r.ice, newDrillsPerWeek: r.new_drills_per_week });
const toPractice = (r: PracticeRow): Practice =>
  practiceSchema.parse({ id: r.id, teamId: r.team_id, date: r.date, startTime: r.start_time.slice(0, 5), minutes: r.minutes, ice: r.ice, status: r.status, blocks: r.blocks });

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
    const { error } = await db
      .from('practices')
      .update({ date: p.date, start_time: p.startTime, minutes: p.minutes, ice: p.ice, status: p.status, blocks: p.blocks, updated_at: new Date().toISOString() })
      .eq('id', p.id);
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
}
