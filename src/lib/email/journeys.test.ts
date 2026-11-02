import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REGISTRY, SECTIONS, idempotencyKey, queuedEntry, type SendFacts } from './journeys';
import { SUPABASE_TEMPLATES } from './supabase-templates';

const DIR = join(process.cwd(), 'src', 'lib', 'email');
// Shared pieces of the frame, not emails.
const NOT_TEMPLATES = new Set(['shell', 'sendEmail', 'esc', 'callout', 'footerLink', 'clock', 'nextPlanPhrase', 'listNames']);

/** Every exported function in src/lib/email/*.ts that returns an Email. */
function templateFunctions(): { file: string; fn: string }[] {
  const out: { file: string; fn: string }[] = [];
  for (const f of readdirSync(DIR)) {
    if (!f.endsWith('.ts') || f.endsWith('.test.ts') || f === 'journeys.ts') continue;
    const src = readFileSync(join(DIR, f), 'utf8');
    for (const m of src.matchAll(/export function (\w+)\([^)]*\):\s*Email\b/g)) if (!NOT_TEMPLATES.has(m[1])) out.push({ file: `src/lib/email/${f}`, fn: m[1] });
  }
  return out;
}

describe('email journey registry', () => {
  it('registers every template that sends to people', () => {
    const found = templateFunctions();
    expect(found.length).toBeGreaterThanOrEqual(10);
    const registered = new Set(REGISTRY.map((e) => `${e.file}#${e.fn}`));
    const missing = found.filter((t) => !registered.has(`${t.file}#${t.fn}`));
    expect(missing, `Add these to src/lib/email/journeys.ts: ${missing.map((m) => m.fn).join(', ')}`).toEqual([]);
  });

  it('registers every Supabase template', () => {
    for (const key of Object.keys(SUPABASE_TEMPLATES)) expect(REGISTRY.some((e) => e.fn === `SUPABASE_TEMPLATES.${key}`)).toBe(true);
  });

  it('points every entry at a file and function that exist', () => {
    for (const e of REGISTRY) {
      const src = readFileSync(join(process.cwd(), e.file), 'utf8');
      const name = e.fn.startsWith('SUPABASE_TEMPLATES.') ? `'${e.fn.split('.')[1]}'` : `function ${e.fn}(`;
      expect(src, `${e.id}: ${e.fn} in ${e.file}`).toContain(name);
    }
  });

  it('has unique ids, known sections, and a sample that renders', () => {
    expect(new Set(REGISTRY.map((e) => e.id)).size).toBe(REGISTRY.length);
    for (const e of REGISTRY) {
      expect(SECTIONS.some((s) => s.id === e.section)).toBe(true);
      const email = e.preview();
      expect(email.subject.length, e.id).toBeGreaterThan(0);
      expect(email.html).toContain('<!doctype html>');
    }
  });

  it('declares the five discovery steps from the spec, all through the outbox', () => {
    const queued = REGISTRY.filter((e) => e.sentBy === 'outbox').map((e) => e.id);
    expect(queued).toEqual(['waitlist.welcome', 'waitlist.nudge', 'waitlist.last-ask', 'coach.first-practice', 'coach.nudge']);
    expect(queuedEntry('coach', 'last-ask')).toBeUndefined();
    expect(queuedEntry('waitlist', 'alert')).toBeUndefined();
  });

  it('checks conditions at send time', () => {
    const f = (o: Partial<SendFacts> = {}): SendFacts => ({ surveyDone: false, unsubscribed: false, isAdmin: false, audience: 'waitlist', ...o });
    const skip = (j: string, s: string, facts: SendFacts) => queuedEntry(j, s)!.skip(facts);
    expect(skip('waitlist', 'welcome', f())).toBeNull();
    expect(skip('waitlist', 'welcome', f({ unsubscribed: true }))).toBe('unsubscribed');
    expect(skip('waitlist', 'nudge', f({ surveyDone: true }))).toBe('survey-done');
    expect(skip('waitlist', 'last-ask', f({ audience: 'coach' }))).toBe('now-a-coach');
    expect(skip('coach', 'first-practice', f({ audience: 'coach', isAdmin: true }))).toBe('admin');
    expect(skip('coach', 'nudge', f({ audience: 'coach', surveyDone: true }))).toBe('survey-done');
    expect(skip('coach', 'nudge', f({ audience: 'coach' }))).toBeNull();
  });

  it('keys each send by journey, step and person', () => expect(idempotencyKey('waitlist', 'nudge', 'p1')).toBe('waitlist-nudge-p1'));
});
