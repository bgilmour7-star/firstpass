#!/usr/bin/env tsx
/**
 * Discovery research files (decision 0027).
 *
 *   npm run research -- sync     Write research/coaches/<code>.md for every person and
 *                                research/themes.md, and delete files for people who were removed.
 *
 * The files are pseudonymous: a code (c-0142), first name, team and age group, never an email, phone
 * or account id (src/lib/discovery/research-files.ts, with a test). The daily "Firstpass daily
 * sign-ups" task runs this and commits to main, so Claude can read what coaches said.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS. Keep it in .env.local or the environment,
 * never in the repo or the browser. Without Supabase variables it reads local mode's
 * .local/discovery.json instead.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { researchFiles } from '../src/lib/discovery/research-files';
import { CODE, type Note, type Person, type SurveyResponse, type Usage } from '../src/lib/discovery/schema';

const ROOT = process.cwd();
const OUT = join(ROOT, 'research');

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(join(ROOT, f))) continue;
    for (const line of readFileSync(join(ROOT, f), 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

type Data = { people: Person[]; responses: SurveyResponse[]; notes: Note[]; usage: Usage[]; themes: string[] };

async function fromSupabase(url: string, key: string): Promise<Data> {
  const db = createClient(url, key, { auth: { persistSession: false } });
  const must = <T>(r: { data: T | null; error: { message: string } | null }, what: string): T => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.data as T;
  };
  const [people, responses, notes, themes, usage] = await Promise.all([
    db.from('research_people').select('id, code, email, first_name, audience, user_id, waitlist_id, unsubscribed_at, created_at'),
    db.from('survey_responses').select('*'),
    db.from('coach_notes').select('id, person_id, kind, body, themes, created_at'),
    db.from('insight_themes').select('name'),
    db.rpc('discovery_usage'),
  ]);
  type P = { id: string; code: string; email: string; first_name: string | null; audience: Person['audience']; user_id: string | null; waitlist_id: string | null; unsubscribed_at: string | null; created_at: string };
  type R = { id: string; person_id: string; audience: SurveyResponse['audience']; role: string | null; age_groups: string[]; planned_how: string | null; planned_when: string | null; hardest_part: string | null; wants_help: string | null; extra: SurveyResponse['extra'] | null; wants_call: boolean; call_times: string[]; phone: string | null; call_status: SurveyResponse['callStatus']; gift_card: SurveyResponse['giftCard']; themes: string[]; created_at: string };
  type N = { id: string; person_id: string; kind: Note['kind']; body: string; themes: string[]; created_at: string };
  type U = { person_id: string; teams: Usage['teams']; practices_run: number; checkins: number; swaps: number; last_active: string | null };
  return {
    people: must(people, 'research_people').map((r: P) => ({ id: r.id, code: r.code, email: r.email, firstName: r.first_name, audience: r.audience, userId: r.user_id, waitlistId: r.waitlist_id, unsubscribedAt: r.unsubscribed_at, createdAt: r.created_at })),
    // The phone number is dropped here as well as never being written.
    responses: must(responses, 'survey_responses').map((r: R) => ({ id: r.id, personId: r.person_id, audience: r.audience, role: r.role, ageGroups: r.age_groups ?? [], plannedHow: r.planned_how, plannedWhen: r.planned_when, hardestPart: r.hardest_part, wantsHelp: r.wants_help, extra: r.extra ?? {}, wantsCall: r.wants_call, callTimes: r.call_times ?? [], phone: null, callStatus: r.call_status, giftCard: r.gift_card, themes: r.themes ?? [], createdAt: r.created_at })),
    notes: must(notes, 'coach_notes').map((n: N) => ({ id: n.id, personId: n.person_id, kind: n.kind, body: n.body, themes: n.themes ?? [], createdAt: n.created_at })),
    themes: must(themes, 'insight_themes').map((t: { name: string }) => t.name),
    usage: must(usage, 'discovery_usage').map((u: U) => ({ personId: u.person_id, teams: u.teams ?? [], practicesRun: u.practices_run, checkins: u.checkins, swaps: u.swaps, lastActive: u.last_active })),
  };
}

function fromLocal(): Data {
  const file = join(ROOT, '.local', 'discovery.json');
  if (!existsSync(file)) throw new Error('No Supabase variables and no .local/discovery.json. Open /admin/survey in local mode once, or set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  const d = JSON.parse(readFileSync(file, 'utf8')) as Data;
  return { people: d.people, responses: d.responses, notes: d.notes, usage: d.usage, themes: d.themes };
}

async function sync() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const data = url && key ? await fromSupabase(url, key) : fromLocal();
  const files = researchFiles(data);
  mkdirSync(join(OUT, 'coaches'), { recursive: true });
  let written = 0;
  for (const f of files) {
    const path = join(ROOT, f.path);
    const before = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (before !== f.body) {
      writeFileSync(path, f.body);
      written++;
    }
  }
  // People removed from the database (a deletion request) lose their file too.
  const keep = new Set(files.map((f) => f.path));
  let removed = 0;
  for (const name of readdirSync(join(OUT, 'coaches'))) {
    if (!name.endsWith('.md') || !CODE.test(name.replace(/\.md$/, ''))) continue;
    if (!keep.has(`research/coaches/${name}`)) {
      rmSync(join(OUT, 'coaches', name));
      removed++;
    }
  }
  console.log(`research: ${data.people.length} people, ${written} file${written === 1 ? '' : 's'} written, ${removed} removed (${url && key ? 'Supabase' : 'local mode'})`);
}

const [cmd] = process.argv.slice(2);
if (cmd === 'sync') {
  sync().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
} else {
  console.log('Usage: npm run research -- sync');
  process.exit(cmd ? 1 : 0);
}
