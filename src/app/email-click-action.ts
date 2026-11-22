'use server';

import { getBroadcastStore } from '@/lib/broadcasts/store';
import { EMAIL_REF } from '@/lib/broadcasts/ref';
import { logError } from '@/lib/errors';

/**
 * A coach landed on Firstpass from an update email link (?from=<ref>-<n>, decision 0036). Records one click for the
 * signed-in coach; 'signed-out' tells the page to keep the tag until they've signed in.
 */
export async function recordEmailClick(from: unknown): Promise<'stored' | 'ignored' | 'signed-out'> {
  const m = typeof from === 'string' ? from.match(EMAIL_REF) : null;
  if (!m) return 'ignored';
  try {
    return await (await getBroadcastStore()).recordClick(m[1], Number(m[2]));
  } catch (e) {
    logError('[email-click] %s', e instanceof Error ? e.message : e);
    return 'ignored';
  }
}
