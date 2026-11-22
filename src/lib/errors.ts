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

/** Emails (also %40-encoded), phone numbers, ids, codes and tokens out; one line, at most 400 characters. */
export function scrub(message: string): string {
  return message
    .replace(/%40/gi, '@')
    .replace(/[^\s@<>()"',;:=&?]+@[^\s<>()"',;:&?]+/g, '<email>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>')
    .replace(/(\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, '<phone>')
    // Join codes are 8+ letters and digits; long words without a digit (function names) stay.
    .replace(/\b(?!PGRST\d)(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{8,}\b/g, '<token>')
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '<token>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

/**
 * An error, or anything with a message (Supabase returns plain objects), becomes its code and message only.
 * Never the whole object: a Postgres error's details can hold a failing row, with names or notes in it.
 */
export function briefly(a: unknown): unknown {
  if (a instanceof Error) return a.message;
  if (a && typeof a === 'object') {
    const { code, message } = a as { code?: unknown; message?: unknown };
    if (typeof message === 'string') return typeof code === 'string' && code ? `${code} ${message}` : message;
    return '[object]';
  }
  return a;
}

export function describe(args: unknown[]): string {
  const parts = args.map(briefly);
  return typeof parts[0] === 'string' ? format(...(parts as [string, ...unknown[]])) : parts.map((p) => String(p)).join(' ');
}

async function save(area: string, message: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // A server-only secret: record_app_error ignores calls without it, so the public key alone can't write.
  const secret = process.env.APP_ERRORS_KEY;
  if (!url || !key || !secret) return;
  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    await db.rpc('record_app_error', { secret, area, message });
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
