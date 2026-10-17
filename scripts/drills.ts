#!/usr/bin/env tsx
/**
 * Drill library CLI for admins and Claude.
 *
 *   npm run drills -- validate              check every file in content/drills against the schema
 *   npm run drills -- preview <id>          render the drill's diagrams to .local/preview/<id>.html
 *   npm run drills -- requests              list open diagram change requests (needs Supabase)
 *   npm run drills -- pull [id]             copy drills from Supabase into content/drills
 *   npm run drills -- push <id>             copy content/drills/<id>.json up to Supabase
 *   npm run drills -- resolve <requestId> "what changed"
 *   npm run drills -- seed [--force]        insert drills that aren't in Supabase yet (--force overwrites content)
 *
 * Supabase commands use SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS. Keep it in .env.local
 * or the environment, never in the repo or the browser.
 *
 * Diagram loop: `requests` → `pull <id>` → edit content/drills/<id>.json → `preview <id>` and look →
 * `push <id>` → `resolve <requestId> "..."`. Status in Supabase is never changed by push; reviewers own it.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { drillSchema, type Drill } from '../src/lib/drills/schema';
import { firstpass } from '../src/lib/ds/bundle.mjs';

const ROOT = join(__dirname, '..');
const CONTENT = join(ROOT, 'content', 'drills');

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

function admin() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see docs/setup.md).');
  return createClient(url, key, { auth: { persistSession: false } });
}

function readLocal(id: string): Drill {
  return drillSchema.parse(JSON.parse(readFileSync(join(CONTENT, `${id}.json`), 'utf8')));
}
function writeLocal(d: Drill) {
  writeFileSync(join(CONTENT, `${d.id}.json`), JSON.stringify(d, null, 2) + '\n');
}
function localIds() {
  return readdirSync(CONTENT).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
}
function toRow(d: Drill) {
  const { id, status, ...content } = d;
  return { id, status, content: { ...content, id } };
}

const commands: Record<string, (args: string[]) => Promise<void> | void> = {
  validate() {
    let bad = 0;
    for (const id of localIds()) {
      const r = drillSchema.safeParse(JSON.parse(readFileSync(join(CONTENT, `${id}.json`), 'utf8')));
      if (r.success) console.log(`ok    ${id}`);
      else {
        bad++;
        console.log(`FAIL  ${id}`);
        for (const i of r.error.issues) console.log(`      ${i.path.join('.')}: ${i.message}`);
      }
    }
    if (bad) process.exit(1);
  },

  preview([id]) {
    if (!id) throw new Error('Usage: preview <id>');
    const d = readLocal(id);
    const RD = firstpass.RinkDiagram;
    const css = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8') + readFileSync(join(ROOT, 'src/styles/ds-bundle.css'), 'utf8');
    const block = (title: string, spec: object) => `<figure><figcaption>${title}</figcaption>${RD.render({ ...spec, title })}</figure>`;
    const steps = RD.steps(d.diagram) as { step: number }[];
    const figs = [block(`${d.funName} · All`, d.diagram), ...steps.map((s) => block(`Step ${s.step}`, { ...d.diagram, activeStep: s.step }))];
    if (d.levels.length) d.levels.forEach((l, i) => figs.push(block(`Level ${i + 2} · ${l.name} · adds: ${l.adds}`, l.diagram)));
    const html = `<!doctype html><meta charset="utf-8"><title>${d.funName}</title><style>${css}
body{font-family:system-ui;margin:24px;background:#fff}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}figure{margin:0}figcaption{font-weight:600;margin-bottom:6px}svg{width:100%;height:auto}</style><main>${figs.join('')}</main>`;
    mkdirSync(join(ROOT, '.local', 'preview'), { recursive: true });
    const out = join(ROOT, '.local', 'preview', `${id}.html`);
    writeFileSync(out, html);
    console.log(out);
  },

  async requests() {
    const db = admin();
    const { data, error } = await db.from('diagram_requests').select('id, drill_id, note, created_at').is('resolved_at', null).order('created_at');
    if (error) throw error;
    if (!data.length) return console.log('No open diagram requests.');
    for (const r of data) console.log(`${r.id}  ${r.drill_id}  ${r.created_at}\n    ${r.note}\n`);
  },

  async pull([id]) {
    const db = admin();
    let q = db.from('drills').select('id, status, content');
    if (id) q = q.eq('id', id);
    const { data, error } = await q;
    if (error) throw error;
    for (const r of data) {
      writeLocal(drillSchema.parse({ ...r.content, id: r.id, status: r.status }));
      console.log(`pulled ${r.id}`);
    }
  },

  async push([id]) {
    if (!id) throw new Error('Usage: push <id>');
    const db = admin();
    const d = readLocal(id);
    const { data: existing } = await db.from('drills').select('status').eq('id', id).maybeSingle();
    const row = toRow(d);
    const { error } = existing
      ? await db.from('drills').update({ content: row.content, updated_at: new Date().toISOString() }).eq('id', id)
      : await db.from('drills').insert(row);
    if (error) throw error;
    console.log(`${existing ? 'updated' : 'inserted'} ${id}${existing ? ` (status stays ${existing.status})` : ''}`);
  },

  async resolve([requestId, ...rest]) {
    const resolution = rest.join(' ').trim();
    if (!requestId || !resolution) throw new Error('Usage: resolve <requestId> "what changed"');
    const db = admin();
    const { error } = await db.from('diagram_requests').update({ resolved_at: new Date().toISOString(), resolution }).eq('id', requestId);
    if (error) throw error;
    console.log(`resolved ${requestId}`);
  },

  async seed(args) {
    const force = args.includes('--force');
    const db = admin();
    const { data: rows, error } = await db.from('drills').select('id');
    if (error) throw error;
    const have = new Set(rows.map((r) => r.id));
    for (const id of localIds()) {
      const d = readLocal(id);
      if (!have.has(id)) {
        const { error: e } = await db.from('drills').insert(toRow(d));
        if (e) throw e;
        console.log(`inserted ${id}`);
      } else if (force) {
        const { error: e } = await db.from('drills').update({ content: toRow(d).content }).eq('id', id);
        if (e) throw e;
        console.log(`overwrote ${id}`);
      } else console.log(`skipped  ${id} (already in Supabase)`);
    }
  },
};

const [cmd, ...args] = process.argv.slice(2);
const run = commands[cmd];
if (!run) {
  console.log(`Commands: ${Object.keys(commands).join(', ')}`);
  process.exit(1);
}
Promise.resolve(run(args)).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
