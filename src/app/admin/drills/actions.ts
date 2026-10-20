'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { getDrillStore } from '@/lib/drills/store';
import { STATUSES, canMove, drillSchema, groupModelProblem, type Status } from '@/lib/drills/schema';
import { getRequestStore } from '@/lib/requests/store';
import { closeRequest, openRequestFor } from '@/lib/requests/outcome';

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
  // A drill a coach asked for: going live or being archived answers the request (decision 0018).
  if (to === 'live' || to === 'archived') {
    const req = await openRequestFor(id, 'new');
    if (req) await closeRequest(req, to === 'live', to === 'archived' ? reason || null : null, current.drill.funName);
  }
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

/** A coach's suggested change (decision 0018): accept Claude's proposal into the drill, or decline with a reason. */
export async function decideChange(requestId: string, accept: boolean, why = ''): Promise<ActionResult> {
  const admin = await requireAdmin();
  const req = await (await getRequestStore()).get(requestId);
  if (!req || (req.state !== 'sent' && req.state !== 'drafted')) return { ok: false, error: 'This request is already decided.' };
  const reason = why.trim().slice(0, 1000) || null;
  const drills = await getDrillStore();
  const current = req.drillId ? await drills.get(req.drillId) : null;
  if (accept) {
    if (req.kind !== 'change' || !req.proposed || !current) return { ok: false, error: 'There’s no proposed change to accept yet.' };
    const next = drillSchema.safeParse({ ...req.proposed, id: current.drill.id, status: current.drill.status });
    if (!next.success) return { ok: false, error: 'Claude’s proposal doesn’t pass the drill checks. Decline it or ask again.' };
    await drills.save(next.data, admin.id);
    await drills.addNote(current.drill.id, `Changed from a coach’s suggestion${req.requesterName ? ` (${req.requesterName})` : ''}: “${req.description.slice(0, 300)}”`, admin.id);
  }
  await closeRequest(req, accept, accept ? null : reason, current?.drill.funName ?? null);
  revalidatePath('/admin/drills');
  revalidatePath('/admin/requests');
  if (req.drillId) revalidatePath(`/admin/drills/${req.drillId}`);
  return { ok: true };
}

/** Decline a new-drill request before (or instead of) reviewing a draft. */
export async function declineRequest(requestId: string, why = ''): Promise<ActionResult> {
  await requireAdmin();
  const req = await (await getRequestStore()).get(requestId);
  if (!req || (req.state !== 'sent' && req.state !== 'drafted')) return { ok: false, error: 'This request is already decided.' };
  await closeRequest(req, false, why.trim().slice(0, 1000) || null, null);
  revalidatePath('/admin/drills');
  revalidatePath('/admin/requests');
  return { ok: true };
}
