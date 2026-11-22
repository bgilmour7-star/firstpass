'use server';

import { getBroadcastStore } from '@/lib/broadcasts/store';
import { logError } from '@/lib/errors';

/** Public: the token is the permission. Turns update emails off for this person. */
export async function stopUpdates(token: string): Promise<boolean> {
  if (typeof token !== 'string' || !/^[A-Za-z0-9-]{6,64}$/.test(token)) return false;
  try {
    return await (await getBroadcastStore()).updatesOff(token);
  } catch (e) {
    logError('[updates] stop failed:', e instanceof Error ? e.message : e);
    return false;
  }
}
