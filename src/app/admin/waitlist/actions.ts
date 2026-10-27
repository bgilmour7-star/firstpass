'use server';

import { revalidatePath } from 'next/cache';
import { requireAnalytics } from '@/lib/auth';
import { getSiteStore } from '@/lib/site/store';
import { WAITLIST_STATUSES, type WaitlistStatus } from '@/lib/site/schema';

/** Brett's progress with each sign-up: New → Emailed → Call booked → Onboarded (may sign up) or Not a fit. */
export async function setWaitlistStatus(id: string, status: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAnalytics('/admin/waitlist');
  if (!WAITLIST_STATUSES.includes(status as WaitlistStatus) || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: 'That status isn’t one we know.' };
  try {
    await (await getSiteStore()).setStatus(id, status as WaitlistStatus);
  } catch (e) {
    console.error('[waitlist] status change failed:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'Couldn’t save. Try again.' };
  }
  revalidatePath('/admin/waitlist');
  revalidatePath('/admin/analytics');
  return { ok: true };
}
