import { drillIds, type Block, type Practice } from './schema';

// Who has worked on a practice, in plain words for the Plans list.
// Coaches only; kids are never named anywhere.

export type PracticeEdit = { userId: string | null; editor: string; summary: string; at: string };
export type PracticeActivity = { edits: PracticeEdit[]; viewedAt: string | null };
export type Snapshot = Pick<Practice, 'blocks' | 'status' | 'attendance' | 'minutes' | 'startTime' | 'date'>;

/** Saves by the same coach within this window are one editing session, so autosave doesn't flood the log. */
export const SESSION_MS = 30 * 60 * 1000;

/** How a coach is shown: the part of their email before the @, capitalised ("kara.l@…" → "Kara.l"). */
export function editorLabel(email: string): string {
  const local = (email.split('@')[0] || 'Coach').trim();
  return (local.charAt(0).toUpperCase() + local.slice(1)).slice(0, 60) || 'Coach';
}

export function initials(label: string): string {
  return label.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase() || '?';
}

const count = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

/** One short phrase for what changed between two versions of a plan. Names a single drill when it can. */
export function describeChange(before: Snapshot, after: Snapshot, name: (drillId: string) => string | undefined): string {
  const ids = (bs: Block[]) => bs.flatMap(drillIds);
  const was = ids(before.blocks), now = ids(after.blocks);
  const added = now.filter((d) => !was.includes(d));
  const removed = was.filter((d) => !now.includes(d));
  if (after.status !== before.status && after.status !== 'draft') return after.status === 'ready' ? 'marked it Ready' : 'marked it Done';
  if (added.length && removed.length && added.length === removed.length) return added.length === 1 && name(added[0]) ? `swapped in ${name(added[0])}` : `swapped ${count(added.length, 'a drill', 'drills')}`;
  if (added.length) return added.length === 1 && name(added[0]) ? `added ${name(added[0])}` : `added ${count(added.length, 'a drill', 'drills')}`;
  if (removed.length) return `removed ${count(removed.length, 'a drill', 'drills')}`;
  if (JSON.stringify(after.attendance) !== JSON.stringify(before.attendance)) return 'set who’s here';
  if (after.blocks.length !== before.blocks.length) return after.blocks.length > before.blocks.length ? 'added a block' : 'removed a block';
  const order = (bs: Block[]) => bs.map((b) => b.id).join();
  if (order(after.blocks) !== order(before.blocks)) return 'reordered the plan';
  const mins = (bs: Block[]) => bs.map((b) => b.minutes).join();
  if (mins(after.blocks) !== mins(before.blocks) || after.minutes !== before.minutes || after.startTime !== before.startTime) return 'changed the times';
  if (after.date !== before.date) return 'moved the date';
  return 'edited the plan';
}

/** The line on a practice card: the latest change, said from the viewer's side. */
export function activityLine(a: PracticeActivity | undefined, me: string, now = Date.now()): { text: string; editors: { label: string; you: boolean }[]; unseen: boolean } | null {
  if (!a || !a.edits.length) return null;
  const last = a.edits[0];
  const you = last.userId === me;
  const seen = new Map<string, { label: string; you: boolean }>();
  for (const e of a.edits) {
    const key = e.userId ?? e.editor;
    if (!seen.has(key)) seen.set(key, { label: e.editor, you: e.userId === me });
  }
  // Your own initials last, so the other coaches read first.
  const editors = [...seen.values()].sort((x, y) => Number(x.you) - Number(y.you));
  const unseen = !you && (!a.viewedAt || a.viewedAt < last.at);
  return { text: `${you ? 'You' : last.editor} ${last.summary} · ${ago(last.at, now)}`, editors, unseen };
}

export function ago(iso: string, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? 'yesterday' : `${d} days ago`;
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}
