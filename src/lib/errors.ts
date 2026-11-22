import { format } from 'node:util';
import { after } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Caught failures (decision 0054), on the server. logError() writes to the console as before and also saves a short, scrubbed
// copy to app_errors, because Vercel's Hobby plan keeps logs for under an hour. The save runs after the
// response, never throws, and does nothing in local mode.

/** "[email] welcome failed: …" → area "email". Anything without a [tag] is "app". */
export function areaOf(message: string): string {
  return /^\[([a-z0-9/_-]{1,40})\]/i.exec(message)?.[1].toLowerCase() ?? 'app';
}

/** Emails, phone numbers, ids and long tokens out; one line, at most 400 characters. */
export function scrub(message: string): string {
  return message
    .replace(/[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}/gi, '<email>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>')
    .replace(/(\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, '<phone>')
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '<token>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

function describe(args: unknown[]): string {
  const parts = args.map((a) => (a instanceof Error ? a.message : a));
  return typeof parts[0] === 'string' ? format(...(parts as [string, ...unknown[]])) : parts.map((p) => String(p)).join(' ');
}

async function save(area: string, message: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    await db.rpc('record_app_error', { area, message });
  } catch {
    // Saving an error must never cause one.
  }
}

/** console.error, plus a saved copy for the morning check and Admin → Analytics. Same arguments as console.error. */
export function logError(...args: unknown[]): void {
  console.error(...args);
  let message: string;
  try {
    message = describe(args);
  } catch {
    return;
  }
  const area = areaOf(message);
  const clean = scrub(message.replace(/^\[[^\]]*\]\s*/, ''));
  try {
    after(() => save(area, clean));
  } catch {
    // Outside a request (a script or test): save straight away instead.
    void save(area, clean);
  }
}
