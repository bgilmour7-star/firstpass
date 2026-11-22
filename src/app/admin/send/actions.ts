'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAnalytics } from '@/lib/auth';
import { getBroadcastStore } from '@/lib/broadcasts/store';
import { deliver, updatesUrl } from '@/lib/broadcasts/send';
import { AGES, SEGMENTS, draftSchema, problems, type Age, type Draft, type Segment } from '@/lib/broadcasts/schema';
import { broadcastEmail } from '@/lib/email/broadcast-email';
import { FROM_BRETT, sendEmail } from '@/lib/email/layout';
import { logError } from '@/lib/errors';

// Admin → Send (decision 0035). Brett only: every action checks requireAnalytics() and validates its input; the
// tables and functions behind the store are RLS'd to can_see_analytics() as well.

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const ID = /^[0-9a-f-]{36}$/i;
const MIGRATION = 'The email tables aren’t set up yet. Run supabase/migrations/20261123000000_broadcasts.sql in the Supabase SQL editor.';
const why = (e: unknown, fallback: string) => {
  const m = e instanceof Error ? e.message : '';
  if (m === 'broadcasts-migration-missing') return MIGRATION;
  logError('[send] %s: %s', fallback, m);
  return fallback;
};

export async function newEmail() {
  await requireAnalytics('/admin/send');
  const id = await (await getBroadcastStore()).create();
  redirect(`/admin/send/${id}`);
}

export async function saveEmail(id: string, input: unknown): Promise<Result> {
  await requireAnalytics('/admin/send');
  const d = draftSchema.safeParse(input);
  if (!ID.test(id) || !d.success) return { ok: false, error: d.success ? 'That email doesn’t exist.' : (d.error.issues[0]?.message ?? 'Something in the email isn’t valid.') };
  try {
    return (await (await getBroadcastStore()).save(id, d.data)) ? { ok: true } : { ok: false, error: 'This email has already been sent.' };
  } catch (e) {
    return { ok: false, error: why(e, 'Couldn’t save. Try again.') };
  }
}

export async function deleteEmail(id: string): Promise<Result> {
  await requireAnalytics('/admin/send');
  if (!ID.test(id)) return { ok: false, error: 'That email doesn’t exist.' };
  try {
    if (!(await (await getBroadcastStore()).remove(id))) return { ok: false, error: 'Only drafts can be deleted.' };
  } catch (e) {
    return { ok: false, error: why(e, 'Couldn’t delete. Try again.') };
  }
  revalidatePath('/admin/send');
  redirect('/admin/send');
}

export async function whoGetsIt(segment: string, age: string | null): Promise<Result<{ count: number; sample: string[] }>> {
  await requireAnalytics('/admin/send');
  if (!SEGMENTS.includes(segment as Segment) || (segment === 'age' && !AGES.includes(age as Age))) return { ok: false, error: 'Pick who gets it.' };
  try {
    const list = await (await getBroadcastStore()).recipients(segment as Segment, segment === 'age' ? (age as Age) : null);
    return { ok: true, count: list.length, sample: list.slice(0, 50).map((r) => [r.firstName, r.email, r.teamName].filter(Boolean).join(' · ')) };
  } catch (e) {
    return { ok: false, error: why(e, 'Couldn’t count who gets it.') };
  }
}

/** The email as a coach sees it, for the preview pane, greeting Brett. */
export async function previewEmail(input: unknown): Promise<Result<{ html: string }>> {
  await requireAnalytics('/admin/send');
  const d = draftSchema.safeParse(input);
  if (!d.success) return { ok: false, error: d.error.issues[0]?.message ?? 'Something in the email isn’t valid.' };
  return { ok: true, html: broadcastEmail({ draft: d.data, firstName: 'Brett', unsubscribeUrl: updatesUrl('preview') }).html };
}

export async function sendTestEmail(input: unknown): Promise<Result> {
  const admin = await requireAnalytics('/admin/send');
  const d = draftSchema.safeParse(input);
  if (!d.success) return { ok: false, error: d.error.issues[0]?.message ?? 'Something in the email isn’t valid.' };
  if (admin.local) return { ok: false, error: 'Local mode has no email. Run with Supabase and RESEND_API_KEY to send a test.' };
  const e = broadcastEmail({ draft: d.data, firstName: 'Brett', unsubscribeUrl: updatesUrl('preview') });
  const ok = await sendEmail(admin.email, { ...e, subject: `[Test] ${e.subject}` }, 'broadcast-test', { from: FROM_BRETT });
  return ok ? { ok: true } : { ok: false, error: 'Couldn’t send. Check RESEND_API_KEY in Vercel.' };
}

/**
 * Save, then send to everyone in the segment right now. expected is the count Brett confirmed: if the segment has
 * changed since (someone signed up or opted out), stop and show the new number instead of sending.
 */
export async function sendNow(id: string, input: unknown, expected: number): Promise<Result<{ sent: number; failed: number; skipped: number; left: number; warning?: string }>> {
  const admin = await requireAnalytics('/admin/send');
  const d = draftSchema.safeParse(input);
  if (!ID.test(id) || !d.success) return { ok: false, error: 'Something in the email isn’t valid.' };
  const draft: Draft = d.data;
  const todo = problems(draft);
  if (todo.length) return { ok: false, error: todo[0] };
  if (admin.local) return { ok: false, error: 'Local mode has no email. Nothing was sent.' };
  const store = await getBroadcastStore();
  try {
    if (!(await store.save(id, draft))) return { ok: false, error: 'This email has already been sent.' };
    let queued = 0;
    try {
      queued = await store.start(id, Number.isInteger(expected) ? expected : -1);
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      const changed = m.match(/^list-changed:(\d+)$/);
      if (changed) return { ok: false, error: `The list changed: it’s ${changed[1]} ${changed[1] === '1' ? 'coach' : 'coaches'} now. Check it and send again.` };
      if (m === 'list-empty') return { ok: false, error: 'Nobody is in this group.' };
      throw e;
    }
    if (!queued) return { ok: false, error: 'This email has already been sent.' };
    const b = await store.get(id);
    const r = await deliver(store, b!);
    revalidatePath('/admin/send');
    return { ok: true, sent: r.sent, failed: r.failed, skipped: r.skipped, left: r.left, warning: r.error };
  } catch (e) {
    return { ok: false, error: why(e, 'Sending stopped. Open the email to see what went out and carry on.') };
  }
}

/** For a send that stopped halfway: send to whoever is still queued. */
export async function carryOn(id: string): Promise<Result<{ sent: number; failed: number; skipped: number; left: number; warning?: string }>> {
  await requireAnalytics('/admin/send');
  if (!ID.test(id)) return { ok: false, error: 'That email doesn’t exist.' };
  const store = await getBroadcastStore();
  try {
    const b = await store.get(id);
    if (!b || b.status !== 'sending') return { ok: false, error: 'Nothing left to send.' };
    const r = await deliver(store, b);
    revalidatePath(`/admin/send/${id}`);
    return { ok: true, sent: r.sent, failed: r.failed, skipped: r.skipped, left: r.left, warning: r.error };
  } catch (e) {
    return { ok: false, error: why(e, 'Sending stopped. Try again.') };
  }
}

const TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export async function uploadImage(form: FormData): Promise<Result<{ url: string }>> {
  await requireAnalytics('/admin/send');
  const file = form.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'Pick an image.' };
  if (!TYPES.includes(file.type)) return { ok: false, error: 'Use a PNG, JPG, GIF or WebP image.' };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: 'That image is over 2 MB. Make it smaller and try again.' };
  try {
    return { ok: true, url: await (await getBroadcastStore()).uploadImage(file.type, await file.arrayBuffer()) };
  } catch (e) {
    if (e instanceof Error && e.message === 'no-images-locally') return { ok: false, error: 'Local mode can’t host images. Paste an https:// image link instead.' };
    return { ok: false, error: why(e, 'Couldn’t upload the image. Try again.') };
  }
}
