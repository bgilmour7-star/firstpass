'use server';

import { revalidatePath } from 'next/cache';
import { requireAnalytics } from '@/lib/auth';
import { getDiscoveryStore } from '@/lib/discovery/store';
import { CALL_STATUSES, GIFT_CARDS, NOTE_KINDS, type CallStatus, type GiftCard, type NoteKind } from '@/lib/discovery/schema';

// Brett's discovery actions (decision 0027). Each one checks requireAnalytics() first; RLS
// (can_see_analytics()) enforces the same rule in the database.

export type ActionResult = { ok: true } | { ok: false; error: string };
const ID = /^[0-9a-z-]{3,64}$/i;
const SAVE_FAILED = 'Couldn’t save. Try again.';

function done(paths: string[]): ActionResult {
  paths.forEach((p) => revalidatePath(p));
  return { ok: true };
}

export async function setCallStatus(responseId: string, status: string): Promise<ActionResult> {
  await requireAnalytics('/admin/survey');
  if (!ID.test(responseId) || !CALL_STATUSES.includes(status as CallStatus)) return { ok: false, error: SAVE_FAILED };
  try {
    await (await getDiscoveryStore()).setCallStatus(responseId, status as CallStatus);
  } catch (e) {
    console.error('[survey] call status failed:', e instanceof Error ? e.message : e);
    return { ok: false, error: SAVE_FAILED };
  }
  return done(['/admin/survey', '/admin/coaches']);
}

export async function setGiftCard(responseId: string, card: string): Promise<ActionResult> {
  await requireAnalytics('/admin/survey');
  if (!ID.test(responseId) || !GIFT_CARDS.includes(card as GiftCard)) return { ok: false, error: SAVE_FAILED };
  try {
    await (await getDiscoveryStore()).setGiftCard(responseId, card as GiftCard);
  } catch (e) {
    console.error('[survey] gift card failed:', e instanceof Error ? e.message : e);
    return { ok: false, error: SAVE_FAILED };
  }
  return done(['/admin/survey', '/admin/coaches']);
}

/** Themes typed by Brett, comma separated. Trimmed, deduplicated, at most 8. */
export async function setThemes(kind: 'response' | 'note', id: string, raw: string): Promise<ActionResult> {
  await requireAnalytics('/admin/survey');
  if ((kind !== 'response' && kind !== 'note') || !ID.test(id)) return { ok: false, error: SAVE_FAILED };
  const themes = [...new Set(raw.split(',').map((t) => t.trim().replace(/\s+/g, ' ').slice(0, 80)).filter(Boolean))].slice(0, 8);
  try {
    await (await getDiscoveryStore()).setThemes({ kind, id }, themes);
  } catch (e) {
    console.error('[survey] themes failed:', e instanceof Error ? e.message : e);
    return { ok: false, error: SAVE_FAILED };
  }
  return done(['/admin/survey', '/admin/coaches']);
}

export async function addNote(personId: string, kind: string, body: string): Promise<ActionResult> {
  await requireAnalytics('/admin/coaches');
  const text = (body ?? '').trim();
  if (!ID.test(personId) || !NOTE_KINDS.includes(kind as NoteKind)) return { ok: false, error: SAVE_FAILED };
  if (!text) return { ok: false, error: 'Write what they said or did first.' };
  if (text.length > 5000) return { ok: false, error: 'That’s over 5,000 characters. Split it into two notes.' };
  try {
    await (await getDiscoveryStore()).addNote(personId, kind as NoteKind, text);
  } catch (e) {
    console.error('[coaches] note failed:', e instanceof Error ? e.message : e);
    return { ok: false, error: SAVE_FAILED };
  }
  return done([`/admin/coaches/${personId}`, '/admin/coaches', '/admin/survey']);
}
