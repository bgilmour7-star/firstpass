'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pips, Rink, RinkStepper } from '@/components/ds';
import { DiagramFlag, StatusPill } from '@/components/status';
import { AGE_GROUPS, BLOCK_FOR, FOCUS_ATTRIBUTES, levelCount, levelOf, startLevelFor, type AgeGroup, GROUPS, MAX_LEVELS, firstSentenceOf, fromZones, shapeLabel, nextStatuses, PART_LABEL, PARTS, EFFORTS, EFFORT_LABEL, FORMATS, FORMAT_LABEL, type DiagramRequest, type Drill, type Status } from '@/lib/drills/schema';
import type { DrillDetail } from '@/lib/drills/store';
import { sameDrill } from '@/lib/drills/same';
import type { DrillRequest } from '@/lib/requests/schema';
import { addReviewNote, closeDiagramRequest, moveStatus, requestDiagramChange, saveDrill } from '../actions';

const MOVE_LABEL: Record<Status, Partial<Record<Status, string>>> = {
  draft: { in_review: 'Send for review', archived: 'Archive' },
  in_review: { approved: 'Approve', draft: 'Back to draft', archived: 'Archive' },
  approved: { live: 'Make live', in_review: 'Back to review', archived: 'Archive' },
  live: { approved: 'Take off live', archived: 'Archive' },
  archived: { in_review: 'Restore to review' },
};
const ORDER: Status[] = ['draft', 'in_review', 'approved', 'live'];

const fmt = (iso: string) => new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function DrillReview({ detail, asked = null }: { detail: DrillDetail; asked?: DrillRequest | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Drill>(detail.drill);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveWhy, setArchiveWhy] = useState('');
  const [pending, start] = useTransition();
  // Status changes only through the status buttons, so it never counts as an unsaved edit.
  const dirty = useMemo(() => !sameDrill({ ...draft, status: null }, { ...detail.drill, status: null }), [draft, detail.drill]);
  // When the saved drill changes (a save, a status move, Claude's redraw), take it on
  // unless the reviewer has edits in progress.
  const shown = useRef(detail.drill);
  useEffect(() => {
    const previous = shown.current;
    shown.current = detail.drill;
    setDraft((d) => (sameDrill(d, previous) ? detail.drill : d));
  }, [detail.drill]);
  const open = detail.requests.filter((r) => !r.resolvedAt);
  const [requestText, setRequestText] = useState('');
  // Feedback for a diagram request sits beside the request box, where the reviewer is looking.
  const [requestMsg, setRequestMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const rotation = draft.groupModel === 'rotation';
  // A rotation's steps, cues and captions come from its zones; derive them live so the
  // diagram caption and the coach preview follow every keystroke.
  const shownDrill = useMemo(() => (rotation ? (fromZones(draft) as Drill) : draft), [draft, rotation]);

  const set = <K extends keyof Drill>(k: K, v: Drill[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function save() {
    start(async () => {
      const r = await saveDrill(draft);
      if (r.ok) {
        setErrors({});
        setMessage({ kind: 'ok', text: 'Saved.' });
        router.refresh();
      } else {
        setErrors(r.fields ?? {});
        setMessage({ kind: 'error', text: r.error });
      }
    });
  }
  function move(to: Status, why = '') {
    if (dirty) {
      setMessage({ kind: 'error', text: 'Save or discard your changes first.' });
      return;
    }
    start(async () => {
      const r = await moveStatus(draft.id, to, why);
      const done = to === 'archived' ? 'Archived. It’s out of the library and the review queue.' : `Moved to ${to.replace('_', ' ')}.`;
      setMessage(r.ok ? { kind: 'ok', text: done } : { kind: 'error', text: r.error });
      if (r.ok) {
        setArchiving(false);
        setArchiveWhy('');
        router.refresh();
      }
    });
  }
  function sendRequest() {
    start(async () => {
      const r = await requestDiagramChange(draft.id, requestText);
      if (r.ok) {
        setRequestText('');
        setRequestMsg({ kind: 'ok', text: 'Sent. It’s at the top of the list below, waiting for Claude.' });
        router.refresh();
      } else setRequestMsg({ kind: 'error', text: r.error });
    });
  }

  function addLevel() {
    const n = draft.levels.length + 2;
    // A new level starts from the diagram before it; the reviewer asks Claude to redraw what changes.
    const from = draft.levels.length ? draft.levels[draft.levels.length - 1].diagram : draft.diagram;
    setDraft((d) => ({ ...d, levels: [...d.levels, { name: '', adds: '', diagram: structuredClone(from) }] }));
    if (!requestText.trim()) setRequestText(`Redraw level ${n} to show what it adds.`);
  }
  const setLevel = (i: number, patch: Partial<Drill['levels'][number]>) => set('levels', draft.levels.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const moves = nextStatuses(draft.status);
  const isLive = detail.drill.status === 'live';

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex flex-col gap-3">
        <Link href="/admin/drills" className="w-fit text-sm text-ink-200 hover:text-ink-100">
          ← All drills
        </Link>
        {asked && (
          <div role="note" className="flex flex-col gap-1 rounded-lg border-[1.5px] border-dashed border-whistle-100 px-3.5 py-2.5 text-sm">
            <p>
              <b className="font-semibold">
                Asked for by {asked.requesterName ?? 'a coach'}
                {asked.teamName ? `, ${asked.teamName}` : ''}.
              </b>{' '}
              <span className="text-ink-200">“{asked.description}”</span>
            </p>
            <p className="text-ink-200">
              {asked.state === 'accepted' ? 'Answered: it went live. ' : asked.state === 'declined' ? 'Answered: declined. ' : `Making it live or archiving it answers ${asked.requesterName ?? 'them'} by email. `}
              <Link href={`/admin/requests/${asked.id}`} className="text-rink-100 underline underline-offset-2">
                See the request
              </Link>
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="min-w-0 flex-[1_1_320px]">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[28px] font-extrabold leading-8">{draft.funName || 'Untitled drill'}</h1>
              <StatusPill status={detail.drill.status} />
              <DiagramFlag count={open.length} />
            </div>
            <p className="text-ink-200">
              {draft.plainName} · <span className="font-mono text-sm">{draft.minutes} min</span>
              {detail.updatedAt && (
                <span className="text-sm">
                  {' '}
                  · Last change {fmt(detail.updatedAt)}
                  {detail.updatedBy ? ` by ${detail.updatedBy}` : ''}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {moves.map((to) => {
              const forward = detail.drill.status === 'archived' || (to !== 'archived' && ORDER.indexOf(to) > ORDER.indexOf(detail.drill.status));
              return (
                <button
                  key={to}
                  type="button"
                  disabled={pending}
                  aria-expanded={to === 'archived' ? archiving : undefined}
                  onClick={() => (to === 'archived' ? setArchiving((x) => !x) : move(to))}
                  className={`min-h-11 rounded-full px-5 text-sm font-medium disabled:opacity-[var(--opacity-disabled)] ${forward ? 'bg-rink-100 text-surface-100 hover:bg-rink-200' : 'border border-border-100 hover:bg-surface-200'}`}
                >
                  {MOVE_LABEL[detail.drill.status][to]}
                </button>
              );
            })}
          </div>
        </div>
        {archiving && (
          <div className="flex max-w-xl flex-col gap-3 rounded-md border border-border-100 bg-surface-200 p-4">
            <div>
              <p className="font-semibold">Archive {draft.funName || 'this drill'}?</p>
              <p className="text-sm text-ink-200">
                {isLive ? 'Coaches won’t find it in the library any more. Plans that already use it will ask to swap it. ' : 'It leaves the review queue. '}
                You can restore it from the Archived tab.
              </p>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Why? (optional)</span>
              <textarea rows={2} className={input} value={archiveWhy} maxLength={2000} placeholder="Too much standing in line, not much skill…" onChange={(e) => setArchiveWhy(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button type="button" disabled={pending} onClick={() => move('archived', archiveWhy)} className="min-h-11 rounded-full bg-ink-100 px-5 text-sm font-semibold text-surface-100 disabled:opacity-[var(--opacity-disabled)]">
                Archive drill
              </button>
              <button type="button" onClick={() => setArchiving(false)} className="min-h-11 rounded-full px-4 text-sm text-ink-200 hover:text-ink-100">
                Cancel
              </button>
            </div>
          </div>
        )}
        {message && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${message.kind === 'error' ? 'text-flag-100' : 'text-good-100'}`}>
            {message.text}
          </p>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Left: what the drill looks like on the ice */}
        <div className="flex min-w-0 flex-col gap-6">
          <RinkStepper spec={shownDrill.diagram} title={draft.funName} noun={rotation ? 'zones' : 'steps'} />

          <Section
            title={`${shapeLabel(draft)} · goes in a ${BLOCK_FOR[draft.groupModel]} block`}
            hint={
              draft.groupModel === 'basic'
                ? 'Level 1 is the drill as written. Add a level when a group is ready for one more thing.'
                : draft.groupModel === 'stations'
                  ? 'One station per group, all at once.'
                  : 'Every group does every zone, moving on the whistle. This is the only place each zone is written.'
            }
          >
            {draft.groupModel === 'basic' && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-3">
                  <span className="mt-8 font-mono text-sm font-medium text-rink-100">Level 1</span>
                  <Field label="Name" help={draft.levels.length ? 'A few words, e.g. “Skate the course”.' : 'Only needed once you add a level.'} error={errors.levelName}>
                    <input className={input} maxLength={40} value={draft.levelName} placeholder="Basic" onChange={(e) => set('levelName', e.target.value)} />
                  </Field>
                </div>
                {draft.levels.map((l, i) => (
                  <div key={i} className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-3 border-t border-border-100 pt-3">
                    <div className="flex flex-col gap-2">
                      <span className="font-mono text-sm font-medium text-rink-100">Level {i + 2}</span>
                      <Rink spec={l.diagram} title={`${draft.funName} level ${i + 2}`} detail="thumb" className="rounded-sm border border-border-100" />
                    </div>
                    <div className="flex min-w-0 flex-col gap-2">
                      <Field label="Name" error={errors[`levels.${i}.name`]}>
                        <input className={input} maxLength={40} value={l.name} placeholder="e.g. Puck the whole way" onChange={(e) => setLevel(i, { name: e.target.value })} />
                      </Field>
                      <Field label="What it adds" help="One thing, in one sentence." error={errors[`levels.${i}.adds`]}>
                        <textarea rows={2} maxLength={200} className={input} value={l.adds} onChange={(e) => setLevel(i, { adds: e.target.value })} />
                      </Field>
                      <button
                        type="button"
                        onClick={() => set('levels', draft.levels.filter((_, j) => j !== i))}
                        className="min-h-9 w-fit rounded-full px-3 text-sm text-flag-100 hover:bg-surface-200"
                      >
                        Remove level {i + 2}
                      </button>
                    </div>
                  </div>
                ))}
                {draft.levels.length < MAX_LEVELS - 1 ? (
                  <button type="button" onClick={addLevel} className="min-h-10 w-fit rounded-full border border-border-100 px-4 text-sm font-medium hover:bg-surface-200">
                    + Add level {draft.levels.length + 2}
                  </button>
                ) : (
                  <p className="text-xs text-ink-200">Three levels is the most: one for each group.</p>
                )}
                {draft.levels.length > 0 && <p className="text-xs text-ink-200">A new level starts with a copy of the diagram before it. Ask Claude below to redraw what changes.</p>}
              </div>
            )}
            {draft.groupModel === 'rotation' && (
              <ul className="flex flex-col">
                {draft.zones?.map((z, i) => (
                  <li key={z.station} className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 border-t border-border-100 py-3">
                    <span className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 font-mono text-sm text-surface-100">{z.station}</span>
                    <div className="flex min-w-0 flex-col gap-2">
                      <Field label="Activity">
                        <input className={input} maxLength={40} value={z.name} onChange={(e) => set('zones', draft.zones!.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      </Field>
                      <Field label="How it works" help="The first sentence is this zone’s diagram caption.">
                        <textarea rows={2} className={input} maxLength={240} value={z.how} onChange={(e) => set('zones', draft.zones!.map((x, j) => (j === i ? { ...x, how: e.target.value } : x)))} />
                      </Field>
                      <Field label="Say this" help="One cue, said on the ice.">
                        <input className={input} maxLength={80} value={z.cue} onChange={(e) => set('zones', draft.zones!.map((x, j) => (j === i ? { ...x, cue: e.target.value } : x)))} />
                      </Field>
                      <ShowsIn items={[`Diagram ${z.station}`, 'Rink-side phone', 'Printout', 'Plan block']} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {draft.groupModel === 'stations' && (
              <ul className="flex flex-col">
                {draft.stations?.map((s, i) => (
                  <li key={s.station} className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 border-t border-border-100 py-3">
                    <span className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 font-mono text-sm text-surface-100">{s.station}</span>
                    <div className="flex min-w-0 flex-col gap-2">
                      <select
                        aria-label={`Group at station ${s.station}`}
                        className={`${input} w-fit`}
                        value={s.group}
                        onChange={(e) => set('stations', draft.stations!.map((x, j) => (j === i ? { ...x, group: e.target.value as (typeof GROUPS)[number] } : x)))}
                      >
                        {GROUPS.map((g) => (
                          <option key={g}>{g}</option>
                        ))}
                      </select>
                      <input
                        aria-label={`What ${s.group} do at station ${s.station}`}
                        className={input}
                        value={s.version}
                        onChange={(e) => set('stations', draft.stations!.map((x, j) => (j === i ? { ...x, version: e.target.value } : x)))}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <DiagramChanges
            requests={detail.requests}
            current={detail.drill.diagram}
            title={draft.funName}
            text={requestText}
            onText={setRequestText}
            onSend={sendRequest}
            pending={pending}
            message={requestMsg}
            onClose={(requestId, how) =>
              start(async () => {
                const r = await closeDiagramRequest(draft.id, requestId, how);
                if (r.ok) {
                  setRequestMsg({ kind: 'ok', text: how === 'looks-right' ? 'Marked done. You can approve now.' : 'Request withdrawn.' });
                  router.refresh();
                } else setRequestMsg({ kind: 'error', text: r.error });
              })
            }
            onRestore={(before) => {
              set('diagram', before);
              setRequestMsg({ kind: 'ok', text: 'The diagram from before the redraw is back. Save to keep it, or Discard.' });
            }}
          />

          <Section title="Source">
            <p className="text-sm">
              {draft.source.url ? (
                <a href={draft.source.url} target="_blank" rel="noreferrer" className="font-medium text-rink-100 underline underline-offset-2">
                  {draft.source.label}
                </a>
              ) : (
                draft.source.label
              )}
              {draft.sourceTitle && <span className="text-ink-200"> · called “{draft.sourceTitle}” there</span>}
            </p>
            {draft.source.note && <p className="mt-1 text-sm text-ink-200">{draft.source.note}</p>}
          </Section>
        </div>

        {/* Right: the words coaches read */}
        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Age groups" hint="Pick every age it works for. Coaches only see it when their team's age is ticked.">
            <AgeGroups drill={draft} error={errors.ageGroups} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
          </Section>

          <Section title="Names">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fun name" help="What the coach shouts. 1–3 words a kid can picture." error={errors.funName}>
                <input className={input} value={draft.funName} onChange={(e) => set('funName', e.target.value)} />
              </Field>
              <Field label="Plain name" help="What it works on, for search and parents." error={errors.plainName}>
                <input className={input} value={draft.plainName} onChange={(e) => set('plainName', e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="Where it goes in a practice" hint="Effort and format drive the variety check in the plan builder.">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Segmented label="Part of the practice" options={PARTS} labels={PART_LABEL} value={draft.part} onChange={(p) => set('part', p)} />
                {draft.lessons.length > 0 && <span className="text-sm text-ink-200">Hockey Canada U7 Lesson {draft.lessons.join(', ')}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Effort</span>
                  <Segmented label="Effort" options={EFFORTS} labels={EFFORT_LABEL} value={draft.effort} onChange={(v) => set('effort', v)} />
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Format</span>
                  <Segmented label="Format" options={FORMATS} labels={FORMAT_LABEL} value={draft.format} onChange={(v) => set('format', v)} />
                </span>
              </div>
            </div>
          </Section>

          <Section title="Setup">
            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
              <Field label={rotation ? 'Min per zone' : 'Minutes'} help={rotation ? `Whistle every ${draft.minutes} · ${draft.minutes * (draft.zones?.length ?? 0)} min in all` : undefined} error={errors.minutes}>
                <input type="number" min={1} max={30} className={`${input} font-mono`} value={draft.minutes} onChange={(e) => set('minutes', Number(e.target.value) || 0)} />
              </Field>
              <Field label="Gear" error={errors.gear}>
                <input className={input} value={draft.gear} onChange={(e) => set('gear', e.target.value)} />
              </Field>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[var(--rink-100)]" checked={draft.worksAsStation} onChange={(e) => set('worksAsStation', e.target.checked)} />
              Works as a station
            </label>
          </Section>

          <Section title={rotation ? 'How it runs' : 'Description'} hint={rotation ? 'The rotation, not the activities. The zones describe those.' : undefined}>
            <Field label={rotation ? 'How the rotation works' : 'How it runs'} error={errors.description}>
              <textarea rows={4} className={input} value={draft.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
          </Section>

          {rotation ? (
            <Section title="What coaches see" hint="Built from the zones as you type.">
              <CoachPreview drill={shownDrill} />
            </Section>
          ) : (
            <>
              <Section title="Steps" hint="One sentence each. Step numbers match the diagram.">
                <ListEditor items={draft.steps} max={6} numbered onChange={(v) => set('steps', v)} error={errors.steps} addLabel="Add a step" />
              </Section>

              <Section title="Cues" hint="What the coach says on the ice. Two is plenty.">
                <ListEditor items={draft.cues} max={3} onChange={(v) => set('cues', v)} error={errors.cues} addLabel="Add a cue" />
              </Section>
            </>
          )}

          <Section title="What it works on" hint="Main for one or two, Some for others.">
            <FocusEditor value={draft.focus} onChange={(v) => set('focus', v)} error={errors.focus} />
          </Section>

          <Section title="Review notes" hint="For you and the head coach. Not shown to coaches.">
            <NoteBox drillId={draft.id} onDone={() => router.refresh()} />
            {detail.notes.length > 0 && (
              <ul className="mt-3 flex flex-col">
                {detail.notes.map((n) => (
                  <li key={n.id} className="flex flex-col gap-0.5 border-t border-border-100 py-3 text-sm">
                    <span className="text-xs text-ink-200">
                      {n.createdBy} · {fmt(n.createdAt)}
                    </span>
                    <span className="whitespace-pre-wrap">{n.body}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {dirty && (
        <div className="fixed bottom-0 left-[var(--rail-w,0px)] right-0 z-30 border-t border-border-100 bg-surface-100 pb-[env(safe-area-inset-bottom,0px)]">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
            <span className="text-sm font-medium">Unsaved changes</span>
            <button type="button" onClick={() => { setDraft(detail.drill); setErrors({}); }} className="ml-auto min-h-11 rounded-full px-4 text-sm hover:bg-surface-200">
              Discard
            </button>
            <button type="button" onClick={save} disabled={pending} className="min-h-11 rounded-full bg-rink-100 px-6 text-sm font-medium text-surface-100 hover:bg-rink-200 disabled:opacity-[var(--opacity-disabled)]">
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Which ages the drill suits (decision 0025): pill toggles, at least one. With U9 ticked and levels
 * added, the level U9 teams start at. Unticking an age drops its start level.
 */
function AgeGroups({ drill, error, onChange }: { drill: Drill; error?: string; onChange: (patch: Pick<Drill, 'ageGroups' | 'startLevel'>) => void }) {
  const levels = levelCount(drill);
  const without = (a: AgeGroup) => Object.fromEntries(Object.entries(drill.startLevel ?? {}).filter(([k]) => k !== a)) as Partial<Record<AgeGroup, number>>;
  const starts = (start: Partial<Record<AgeGroup, number>>) => (Object.keys(start).length ? start : undefined);
  function toggle(a: AgeGroup) {
    const on = drill.ageGroups.includes(a);
    if (on && drill.ageGroups.length === 1) return;
    const ageGroups = on ? drill.ageGroups.filter((x) => x !== a) : AGE_GROUPS.filter((x) => x === a || drill.ageGroups.includes(x));
    onChange({ ageGroups, startLevel: on ? starts(without(a)) : drill.startLevel });
  }
  function setStart(a: AgeGroup, n: number) {
    const rest = without(a);
    onChange({ ageGroups: drill.ageGroups, startLevel: starts(n > 1 ? { ...rest, [a]: n } : rest) });
  }
  const others = drill.ageGroups.filter((a) => a !== 'U9');
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Age groups" className="flex flex-wrap gap-2">
        {AGE_GROUPS.map((a) => {
          const on = drill.ageGroups.includes(a);
          const last = on && drill.ageGroups.length === 1;
          return (
            <button
              key={a}
              type="button"
              aria-pressed={on}
              aria-disabled={last || undefined}
              title={last ? 'A drill needs at least one age group.' : undefined}
              onClick={() => toggle(a)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] px-[18px] text-[15px] ${on ? 'border-ink-100 bg-ink-100 font-semibold text-surface-100' : 'border-border-200 bg-surface-100 font-medium text-ink-100 hover:bg-surface-200'}`}
            >
              {on && (
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M2.5 7.5 5.5 10.5 11.5 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {a}
            </button>
          );
        })}
      </div>
      {error && <span className="text-xs font-medium text-flag-100">{error}</span>}
      {drill.ageGroups.includes('U9') && levels > 1 && (
        <div className="flex flex-col gap-2 border-t border-border-100 pt-4">
          <label htmlFor="start-u9" className="text-sm font-semibold">
            U9 teams start at
          </label>
          <select id="start-u9" className={`${input} min-h-12`} value={startLevelFor(drill, 'U9')} onChange={(e) => setStart('U9', Number(e.target.value))}>
            {Array.from({ length: levels }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Level {n} · {n === 1 ? drill.levelName || drill.plainName || 'Basic' : levelOf(drill, n).name || `Level ${n}`}
              </option>
            ))}
          </select>
          {others.length > 0 && <span className="text-[13px] text-ink-200">{others.map((a) => `${a} teams start at Level ${startLevelFor(drill, a)}`).join('. ')}.</span>}
        </div>
      )}
    </div>
  );
}

const input = 'w-full rounded-md border border-border-100 bg-surface-100 px-3 py-2 text-[15px] leading-6 placeholder:text-ink-200/70 focus-visible:border-rink-100';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t-2 border-ink-100 pt-3">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-[17px] font-extrabold">{title}</h2>
        {hint && <span className="text-xs text-ink-200">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string>({ label, options, labels, value, onChange }: { label: string; options: readonly T[]; labels: Record<T, string>; value: T | undefined; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-surface-300 p-[3px]">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={`min-h-9 rounded-full px-4 text-sm ${value === o ? 'bg-surface-100 font-semibold shadow-sm' : 'text-ink-200 hover:text-ink-100'}`}
        >
          {labels[o]}
        </button>
      ))}
    </div>
  );
}

function Field({ label, help, error, children }: { label: string; help?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold text-ink-200">{label}</span>
      {children}
      {help && !error && <span className="text-xs text-ink-200">{help}</span>}
      {error && <span className="text-xs font-medium text-flag-100">{error}</span>}
    </label>
  );
}

function ListEditor({ items, onChange, max, numbered, error, addLabel }: { items: string[]; onChange: (v: string[]) => void; max: number; numbered?: boolean; error?: string; addLabel: string }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          {numbered && <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-ink-100 font-mono text-xs text-surface-100">{i + 1}</span>}
          <input aria-label={`${numbered ? 'Step' : 'Cue'} ${i + 1}`} className={input} value={s} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" aria-label={`Remove ${numbered ? 'step' : 'cue'} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))} disabled={items.length <= 1} className="min-h-10 min-w-10 rounded-full text-ink-200 hover:bg-surface-200 disabled:opacity-30">
            ×
          </button>
        </div>
      ))}
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, ''])} className="w-fit text-sm font-medium text-rink-100">
          + {addLabel}
        </button>
      )}
      {error && <span className="text-xs font-medium text-flag-100">{error}</span>}
    </div>
  );
}

type Focus = Drill['focus'];
function FocusEditor({ value, onChange, error }: { value: Focus; onChange: (v: Focus) => void; error?: string }) {
  const levelOf = (a: string) => (value.find((f) => f.attribute === a)?.level ?? 0) as 0 | 1 | 2;
  function setLevel(a: (typeof FOCUS_ATTRIBUTES)[number], level: 0 | 1 | 2) {
    if (level === 0) return onChange(value.filter((f) => f.attribute !== a));
    const existing = value.find((f) => f.attribute === a);
    const next = existing ? value.map((f) => (f.attribute === a ? { ...f, level } : f)) : [...value, { attribute: a, level, why: '' }];
    onChange(FOCUS_ATTRIBUTES.flatMap((x) => next.filter((f) => f.attribute === x)));
  }
  return (
    <div className="flex flex-col">
      {FOCUS_ATTRIBUTES.map((a) => {
        const l = levelOf(a);
        const f = value.find((x) => x.attribute === a);
        return (
          <div key={a} className="grid grid-cols-[22px_minmax(0,1fr)] gap-x-2 border-t border-border-100 py-2">
            <span className="pt-1">
              <Pips level={l} />
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`text-sm ${l === 2 ? 'font-bold' : l === 1 ? 'font-medium' : 'text-ink-200'}`}>{a}</span>
                <div role="radiogroup" aria-label={`${a} focus`} className="inline-flex rounded-full border border-border-100 p-0.5">
                  {(['None', 'Some', 'Main'] as const).map((w, i) => (
                    <button
                      key={w}
                      type="button"
                      role="radio"
                      aria-checked={l === i}
                      onClick={() => setLevel(a, i as 0 | 1 | 2)}
                      className={`min-h-7 rounded-full px-2.5 text-xs ${l === i ? 'bg-ink-100 text-surface-100' : 'text-ink-200 hover:bg-surface-200'}`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
              {f && (
                <input aria-label={`Why ${a}`} placeholder="Why, in one line" className={`${input} py-1.5 text-sm`} value={f.why} onChange={(e) => onChange(value.map((x) => (x.attribute === a ? { ...x, why: e.target.value } : x)))} />
              )}
            </div>
          </div>
        );
      })}
      {error && <span className="pt-1 text-xs font-medium text-flag-100">{error}</span>}
    </div>
  );
}

function NoteBox({ drillId, onDone }: { drillId: string; onDone: () => void }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="review-note" className="sr-only">
        Add a review note
      </label>
      <textarea id="review-note" rows={2} className={input} placeholder="e.g. Head coach: Sharks need the coach closer at station C." value={text} onChange={(e) => setText(e.target.value)} />
      <button
        type="button"
        disabled={pending || !text.trim()}
        onClick={() =>
          start(async () => {
            const r = await addReviewNote(drillId, text);
            if (r.ok) {
              setText('');
              setErr('');
              onDone();
            } else setErr(r.error);
          })
        }
        className="min-h-10 w-fit rounded-full border border-border-100 px-4 text-sm font-medium hover:bg-surface-200 disabled:opacity-[var(--opacity-disabled)]"
      >
        Add note
      </button>
      {err && <span className="text-xs text-flag-100">{err}</span>}
    </div>
  );
}

function ShowsIn({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Shows in">
      <span className="text-xs text-ink-200">Shows in</span>
      {items.map((t) => (
        <span key={t} className="rounded-sm border border-border-100 bg-surface-200 px-2 py-0.5 text-xs text-ink-200">
          {t}
        </span>
      ))}
    </div>
  );
}

// What coaches see of a rotation, built from its zones: the same text on three surfaces.
const PREVIEWS = [
  { key: 'phone', label: 'Rink-side phone', note: 'A big cue per zone, readable at arm’s length.' },
  { key: 'print', label: 'Printout', note: 'The full “How it works”, with the cue as the key point.' },
  { key: 'plan', label: 'Plan block', note: 'The activity and one line per zone, in the plan’s Rotation block.' },
] as const;
function CoachPreview({ drill }: { drill: Drill }) {
  const [mode, setMode] = useState<(typeof PREVIEWS)[number]['key']>('phone');
  const zones = drill.zones ?? [];
  const note = PREVIEWS.find((p) => p.key === mode)!.note;
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface-200 p-3">
      <div role="tablist" aria-label="Preview" className="inline-flex w-fit max-w-full flex-wrap rounded-full bg-surface-300 p-[3px]">
        {PREVIEWS.map((p) => (
          <button
            key={p.key}
            type="button"
            role="tab"
            aria-selected={mode === p.key}
            onClick={() => setMode(p.key)}
            className={`min-h-9 rounded-full px-3 text-sm ${mode === p.key ? 'bg-surface-100 font-semibold shadow-sm' : 'text-ink-200 hover:text-ink-100'}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="rounded-md border border-border-100 bg-surface-100 p-3">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <b className="font-display text-lg">{mode === 'plan' ? `Rotation · ${drill.funName}` : drill.funName}</b>
          <span className="font-mono text-xs text-ink-200">
            {drill.minutes * zones.length} min · whistle every {drill.minutes}
          </span>
        </div>
        <ul className="flex flex-col">
          {zones.map((z) => (
            <li key={z.station} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-t border-border-100 py-2.5">
              <span
                className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-sm ${mode === 'print' ? 'border-[1.5px] border-ink-100' : 'bg-ink-100 text-surface-100'}`}
              >
                {z.station}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-semibold">{z.name || <span className="text-ink-200">No activity yet</span>}</span>
                {mode === 'phone' && <span className="font-display text-xl font-semibold leading-7">{z.cue ? `“${z.cue}”` : <span className="text-ink-200">No cue yet</span>}</span>}
                {mode === 'print' && (
                  <>
                    <span className="text-sm">{z.how}</span>
                    {z.cue && <span className="text-sm font-semibold">Key point: {z.cue}</span>}
                  </>
                )}
                {mode === 'plan' && <span className="text-sm text-ink-200">{firstSentenceOf(z.how)}</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-ink-200">{note}</p>
    </div>
  );
}

// Asking Claude to redraw. The loop is not instant: a Claude session in the Firstpass project
// picks open requests up, redraws, and marks them done. So the screen says plainly where each
// request is, and shows the redraw beside the diagram it replaced.
function DiagramChanges({
  requests,
  current,
  title,
  text,
  onText,
  onSend,
  pending,
  message,
  onRestore,
  onClose,
}: {
  requests: DiagramRequest[];
  current: Drill['diagram'];
  title: string;
  text: string;
  onText: (v: string) => void;
  onSend: () => void;
  pending: boolean;
  message: { kind: 'ok' | 'error'; text: string } | null;
  onRestore: (before: Drill['diagram']) => void;
  onClose: (requestId: string, how: 'looks-right' | 'withdraw') => void;
}) {
  const open = requests.filter((r) => !r.resolvedAt);
  const done = requests.filter((r) => r.resolvedAt);
  return (
    <Section title="Diagram changes" hint="Describe the change. Claude redraws it and marks it done here.">
      <div className="flex flex-col gap-2">
        <label htmlFor="diagram-request" className="sr-only">
          What should change in the diagram
        </label>
        <textarea
          id="diagram-request"
          rows={3}
          className={input}
          placeholder="e.g. Put a coach in zone C, standing by the last pylon."
          value={text}
          onChange={(e) => onText(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onSend} disabled={pending || !text.trim()} className="min-h-10 w-fit rounded-full bg-ink-100 px-4 text-sm font-medium text-surface-100 disabled:opacity-[var(--opacity-disabled)]">
            {pending ? 'Sending…' : 'Ask Claude to redraw'}
          </button>
          {message && (
            <span role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${message.kind === 'error' ? 'text-flag-100' : 'text-good-100'}`}>
              {message.text}
            </span>
          )}
        </div>
      </div>

      {open.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-border-100 p-3">
          <p className="text-sm">
            <b>Open requests.</b> Claude picks them up when you ask it to work the diagram requests. Approving waits until each one is closed.
          </p>
          <ul className="flex flex-col">
            {open.map((r) => {
              // A redraw has landed when the diagram no longer matches the one the request was made on.
              const redrawn = Boolean(r.before) && !sameDrill(r.before, current);
              return (
                <li key={r.id} className="flex flex-col gap-2 border-t border-border-100 py-2.5 text-sm">
                  <span className="whitespace-pre-wrap">“{r.note}”</span>
                  <Track steps={[`Sent ${fmt(r.createdAt)} by ${r.createdBy}`, 'Claude redraws', 'You check it here']} at={redrawn ? 2 : 1} />
                  {redrawn && r.before && (
                    <div className="grid grid-cols-2 gap-3">
                      <figure className="m-0 min-w-0">
                        <figcaption className="mb-1 text-xs text-ink-200">Before</figcaption>
                        <Rink spec={r.before} title={`${title} before`} detail="thumb" className="rounded-sm border border-border-100" />
                      </figure>
                      <figure className="m-0 min-w-0">
                        <figcaption className="mb-1 text-xs font-semibold">Now</figcaption>
                        <Rink spec={current} title={`${title} now`} detail="thumb" className="rounded-sm outline outline-2 outline-whistle-100" />
                      </figure>
                    </div>
                  )}
                  <span className="flex flex-wrap items-center gap-2">
                    {redrawn ? (
                      <button type="button" disabled={pending} onClick={() => onClose(r.id, 'looks-right')} className="min-h-10 rounded-full bg-ink-100 px-4 text-sm font-medium text-surface-100 disabled:opacity-[var(--opacity-disabled)]">
                        Looks right, mark done
                      </button>
                    ) : (
                      <span className="text-xs text-ink-200">Not redrawn yet.</span>
                    )}
                    <button type="button" disabled={pending} onClick={() => onClose(r.id, 'withdraw')} className="min-h-10 rounded-full px-3 text-sm text-ink-200 hover:bg-surface-200 hover:text-ink-100 disabled:opacity-[var(--opacity-disabled)]">
                      Withdraw request
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {done.length > 0 && (
        <ul className="flex flex-col">
          {done.map((r, i) => (
            <li key={r.id} className="flex flex-col gap-2 border-t border-border-100 py-3 text-sm">
              <span className="flex flex-wrap items-center gap-2 text-xs text-ink-200">
                <span className="rounded-full bg-surface-300 px-2 py-0.5 font-semibold text-ink-100">Done</span>
                Redrawn {fmt(r.resolvedAt!)} · asked by {r.createdBy}
              </span>
              <span className="whitespace-pre-wrap">“{r.note}”</span>
              {r.resolution && (
                <span>
                  <b>What changed:</b> {r.resolution}
                </span>
              )}
              {/* The newest redraw can be compared with what it replaced, and undone. */}
              {i === 0 && r.before && (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-3">
                    <figure className="m-0 min-w-0">
                      <figcaption className="mb-1 text-xs text-ink-200">Before</figcaption>
                      <Rink spec={r.before} title={`${title} before`} detail="thumb" className="rounded-sm border border-border-100" />
                    </figure>
                    <figure className="m-0 min-w-0">
                      <figcaption className="mb-1 text-xs font-semibold">Now</figcaption>
                      <Rink spec={current} title={`${title} now`} detail="thumb" className="rounded-sm outline outline-2 outline-whistle-100" />
                    </figure>
                  </div>
                  <button type="button" onClick={() => onRestore(r.before!)} className="min-h-10 w-fit rounded-full border border-border-100 px-4 text-sm font-medium hover:bg-surface-200">
                    Put the old diagram back
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Track({ steps, at }: { steps: string[]; at: number }) {
  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-200" aria-label="Progress">
      {steps.map((t, i) => (
        <li key={t} className={`flex items-center gap-1.5 ${i === at ? 'font-semibold text-ink-100' : ''}`} aria-current={i === at ? 'step' : undefined}>
          <span className={`h-2.5 w-2.5 rounded-full border-[1.5px] ${i < at ? 'border-ink-200 bg-ink-200' : i === at ? 'border-whistle-100 bg-whistle-100' : 'border-ink-200'}`} />
          {t}
        </li>
      ))}
    </ol>
  );
}
