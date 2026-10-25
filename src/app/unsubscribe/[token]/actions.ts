'use server';

import { getDiscoveryStore } from '@/lib/discovery/store';

/** Public: the token is the permission. Sets unsubscribed_at and skips every queued discovery email. */
export async function unsubscribe(token: string): Promise<boolean> {
  if (typeof token !== 'string' || !/^[A-Za-z0-9-]{6,64}$/.test(token)) return false;
  try {
    return await (await getDiscoveryStore()).unsubscribe(token);
  } catch (e) {
    console.error('[unsubscribe] failed:', e instanceof Error ? e.message : e);
    return false;
  }
}
