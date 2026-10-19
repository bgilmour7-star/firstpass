'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { getDrillStore } from '@/lib/drills/store';
import { STATUSES, canMove, drillSchema, groupModelProblem, type Status } from '@/lib/drills/schema';

export type ActionResult = { ok: true } | { ok: false; error: string; fields?: Record<string, string> };

export async function saveDrill(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = drillSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[i.path.join('.') || 'form'] ??= i.message;
    return { ok: false, error: 'Some fields need fixing before this can be saved.', fields };
  }
  const store = await getDrillStore();
  const current = await store.get(parsed.data.id);
  if (!current) return { ok: false, error: 'This drill no longer exists.' };
  // Status only changes through moveStatus, so a save can't skip review.
  await store.save({ ...parsed.data, status: current.drill.status }, admin.id);
  revalidatePath('/admin/drills');
  revalidatePath(`/admin/drills/${parsed.data.id}`);
  return { ok: true };
}

export async function moveStatus(id: string, to: string, why = ''): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!STATUSES.includes(to as Status)) return { ok: false, error: 'Unknown status.' };
  const store = await getDrillStore();
  const current = await store.get(id);
  if (!current) return { ok: false, error: 'This drill no longer exists.' };
  const open = current.requests.filter((r) => !r.resolvedAt).length;
  const check = canMove(current.drill.status, to as Status, open);
  if (!check.ok) return { ok: false, error: check.reason! };
  if (to === 'approved') {
    const problem = groupModelProblem(current.drill);
    if (problem) return { ok: false, error: problem };
  }
  await store.setStatus(id, to as Status, admin.id);
  // Why it was archived goes in the review notes, so whoever restores it later can see.
  const reason = why.trim().slice(0, 2000);
  if (to === 'archived') await store.addNote(id, reason ? `Archived: ${reason}` : 'Archived.', admin.id);
  if (current.drill.status === 'archived') await store.addNote(id, 'Restored to review.', admin.id);
  revalidatePath('/admin/drills');
  revalidatePath(`/admin/drills/${id}`);
  return { ok: true };
}

export async function requestDiagramChange(id: string, note: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const text = note.trim();
  if (!text) return { ok: false, error: 'Say what should change in the diagram.' };
  if (text.length > 2000) return { ok: false, error: 'Keep it under 2,000 characters.' };
  const store = await getDrillStore();
  const current = await store.get(id);
  if (!current) return { ok: false, error: 'This drill no longer exists.' };
  await store.addDiagramRequest(id, text, admin.id, current.drill.diagram);
  revalidatePath('/admin/drills');
  revalidatePath(`/admin/drills/${id}`);
  return { ok: true };
}

export async function addReviewNote(id: string, body: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const text = body.trim();
  if (!text) return { ok: false, error: 'Write a note first.' };
  if (text.length > 2000) return { ok: false, error: 'Keep it under 2,000 characters.' };
  const store = await getDrillStore();
  await store.addNote(id, text, admin.id);
  revalidatePath(`/admin/drills/${id}`);
  return { ok: true };
}

/**
 * A reviewer closes an open diagram request themselves: either the redraw is in and looks right,
 * or they no longer need it. Approving waits for open requests, so this unblocks it.
 */
export async function closeDiagramRequest(drillId: string, requestId: string, how: 'looks-right' | 'withdraw'): Promise<ActionResult> {
  await requireAdmin();
  const store = await getDrillStore();
  const current = await store.get(drillId);
  const req = current?.requests.find((r) => r.id === requestId && !r.resolvedAt);
  if (!current || !req) return { ok: false, error: 'That request is already closed. Reload to see the latest.' };
  const resolution = how === 'looks-right' ? 'Checked in review: the redraw looks right.' : 'Withdrawn in review: no redraw needed.';
  try {
    await store.resolveDiagramRequest(requestId, drillId, resolution);
  } catch (e) {
    console.error('[review] closing a diagram request failed:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'Couldn’t close it. Try again in a minute.' };
  }
  revalidatePath('/admin/drills');
  revalidatePath(`/admin/drills/${drillId}`);
  return { ok: true };
}
