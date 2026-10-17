'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pips, Rink, RinkStepper } from '@/components/ds';
import { DiagramFlag, StatusPill } from '@/components/status';
import { FOCUS_ATTRIBUTES, GROUPS, nextStatuses, PART_LABEL, PARTS, type Drill, type Status } from '@/lib/drills/schema';
import type { DrillDetail } from '@/lib/drills/store';
import { sameDrill } from '@/lib/drills/same';
import { addReviewNote, moveStatus, requestDiagramChange, saveDrill } from '../actions';

const MOVE_LABEL: Record<Status, Partial<Record<Status, string>>> = {
  draft: { in_review: 'Send for review' },
  in_review: { approved: 'Approve', draft: 'Back to draft' },
  approved: { live: 'Make live', in_review: 'Back to review' },
  live: { approved: 'Take off live' },
};

const fmt = (iso: string) => new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function DrillReview({ detail }: { detail: DrillDetail }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Drill>(detail.drill);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
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
  function move(to: Status) {
    if (dirty) {
      setMessage({ kind: 'error', text: 'Save or discard your changes first.' });
      return;
    }
    start(async () => {
      const r = await moveStatus(draft.id, to);
      setMessage(r.ok ? { kind: 'ok', text: `Moved to ${to.replace('_', ' ')}.` } : { kind: 'error', text: r.error });
      if (r.ok) router.refresh();
    });
  }
  function sendRequest() {
    start(async () => {
      const r = await requestDiagramChange(draft.id, requestText);
      if (r.ok) {
        setRequestText('');
        setMessage({ kind: 'ok', text: 'Sent. Claude will redraw it and mark the request done.' });
        router.refresh();
      } else setMessage({ kind: 'error', text: r.error });
    });
  }

  function applyModel(model: 'levels' | 'stations') {
    const versionOf = (g: string) => draft.versions?.find((v) => v.group === g)?.version ?? '';
    if (model === 'levels') {
      const order = ['Sharks', 'Bears', 'Eagles'] as const;
      setDraft((d) => ({
        ...d,
        groupModel: 'levels',
        levels: order.map((g, i) => ({ level: `1.${i}`, name: '', adds: versionOf(g), groups: [g], diagram: d.diagram })),
      }));
      setRequestText('Redraw as a progression: one diagram per level (1.0, 1.1, 1.2), each adding one thing.');
    } else {
      setDraft((d) => ({
        ...d,
        groupModel: 'stations',
        stations: [
          { station: 'A', group: 'Eagles', version: versionOf('Eagles') },
          { station: 'B', group: 'Bears', version: versionOf('Bears') },
          { station: 'C', group: 'Sharks', version: versionOf('Sharks') },
        ],
      }));
      setRequestText('Redraw as group stations: Eagles in A, Bears in B, Sharks in C, all at once on half ice.');
    }
  }

  const moves = nextStatuses(draft.status);

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex flex-col gap-3">
        <Link href="/admin/drills" className="w-fit text-sm text-ink-200 hover:text-ink-100">
          ← All drills
        </Link>
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
              const forward = ['draft', 'in_review', 'approved', 'live'].indexOf(to) > ['draft', 'in_review', 'approved', 'live'].indexOf(detail.drill.status);
              return (
                <button
                  key={to}
                  type="button"
                  disabled={pending}
                  onClick={() => move(to)}
                  className={`min-h-11 rounded-full px-5 text-sm font-medium disabled:opacity-[var(--opacity-disabled)] ${forward ? 'bg-rink-100 text-surface-100 hover:bg-rink-200' : 'border border-border-100 hover:bg-surface-200'}`}
                >
                  {MOVE_LABEL[detail.drill.status][to]}
                </button>
              );
            })}
          </div>
        </div>
        {message && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${message.kind === 'error' ? 'text-flag-100' : 'text-good-100'}`}>
            {message.text}
          </p>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Left: what the drill looks like on the ice */}
        <div className="flex min-w-0 flex-col gap-6">
          <RinkStepper spec={detail.drill.diagram} title={draft.funName} />

          <Section
            title={draft.groupModel === 'levels' ? 'Levels by group' : draft.groupModel === 'stations' ? 'Group stations' : draft.groupModel === 'rotation' ? 'Rotation zones' : draft.groupModel === 'together' ? 'Groups' : 'Groups'}
            hint={draft.groupModel === 'levels' ? 'Same drill, one thing added each level.' : draft.groupModel === 'stations' ? 'One station per group, all at once.' : draft.groupModel === 'rotation' ? 'Every group does every zone, moving on the whistle.' : undefined}
          >
            {draft.groupModel === 'versions' && (
              <div className="flex flex-col gap-3 rounded-md border border-whistle-100 p-4">
                <p className="text-sm">
                  <b>Pick how the groups use this drill.</b> Levels if it builds up (skate, then puck, then a pass). Stations if each group plays its own version at the same time.
                </p>
                <ul className="text-sm text-ink-200">
                  {draft.versions?.map((v) => (
                    <li key={v.group}>
                      <b className="text-ink-100">{v.group}:</b> {v.version}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => applyModel('levels')} className="min-h-10 rounded-full border border-border-100 px-4 text-sm font-medium hover:bg-surface-200">
                    Use levels
                  </button>
                  <button type="button" onClick={() => applyModel('stations')} className="min-h-10 rounded-full border border-border-100 px-4 text-sm font-medium hover:bg-surface-200">
                    Use stations
                  </button>
                </div>
              </div>
            )}
            {draft.groupModel === 'levels' && (
              <ol className="grid gap-4 sm:grid-cols-3">
                {draft.levels?.map((l, i) => (
                  <li key={i} className="flex min-w-0 flex-col gap-2">
                    <Rink spec={l.diagram} title={`${draft.funName} ${l.level}`} detail="thumb" className="rounded-sm border border-border-100" />
                    <span className="font-mono text-sm font-medium text-rink-100">{l.level}</span>
                    <Field label="Level name" error={errors[`levels.${i}.name`]}>
                      <input className={input} value={l.name} onChange={(e) => set('levels', draft.levels!.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    </Field>
                    <Field label="What it adds">
                      <textarea rows={3} className={input} value={l.adds} onChange={(e) => set('levels', draft.levels!.map((x, j) => (j === i ? { ...x, adds: e.target.value } : x)))} />
                    </Field>
                    <GroupPicker
                      value={l.groups}
                      onChange={(groups) => set('levels', draft.levels!.map((x, j) => (j === i ? { ...x, groups } : x)))}
                    />
                  </li>
                ))}
              </ol>
            )}
            {draft.groupModel === 'together' && <p className="text-sm text-ink-200">Everyone together: the whole team does this at once, so there are no groups to set.</p>}
            {draft.groupModel === 'rotation' && (
              <ul className="flex flex-col">
                {draft.zones?.map((z, i) => (
                  <li key={z.station} className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 border-t border-border-100 py-3">
                    <span className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 font-mono text-sm text-surface-100">{z.station}</span>
                    <div className="flex min-w-0 flex-col gap-2">
                      <Field label="Activity">
                        <input className={input} maxLength={40} value={z.name} onChange={(e) => set('zones', draft.zones!.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      </Field>
                      <Field label="How it works">
                        <textarea rows={2} className={input} maxLength={240} value={z.how} onChange={(e) => set('zones', draft.zones!.map((x, j) => (j === i ? { ...x, how: e.target.value } : x)))} />
                      </Field>
                      <Field label="Say this">
                        <input className={input} maxLength={80} value={z.cue} onChange={(e) => set('zones', draft.zones!.map((x, j) => (j === i ? { ...x, cue: e.target.value } : x)))} />
                      </Field>
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

          <Section title="Diagram changes" hint="Describe the change. Claude redraws it and marks it done here.">
            <div className="flex flex-col gap-2">
              <label htmlFor="diagram-request" className="sr-only">
                What should change in the diagram
              </label>
              <textarea
                id="diagram-request"
                rows={3}
                className={input}
                placeholder="e.g. Start from the corner. The coach passes from the blue line as they come back down."
                value={requestText}
                onChange={(e) => setRequestText(e.target.value)}
              />
              <button type="button" onClick={sendRequest} disabled={pending || !requestText.trim()} className="min-h-10 w-fit rounded-full bg-ink-100 px-4 text-sm font-medium text-surface-100 disabled:opacity-[var(--opacity-disabled)]">
                Ask Claude to redraw
              </button>
            </div>
            {detail.requests.length > 0 && (
              <ul className="mt-3 flex flex-col">
                {detail.requests.map((r) => (
                  <li key={r.id} className="flex flex-col gap-1 border-t border-border-100 py-3 text-sm">
                    <span className="flex flex-wrap items-center gap-2 text-xs text-ink-200">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${r.resolvedAt ? 'bg-surface-300 text-ink-100' : 'border border-whistle-100 text-whistle-100'}`}>{r.resolvedAt ? 'Done' : 'Open'}</span>
                      {r.createdBy} · {fmt(r.createdAt)}
                    </span>
                    <span>{r.note}</span>
                    {r.resolution && <span className="text-ink-200">Claude: {r.resolution}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

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

          <Section title="Where it goes in a practice">
            <div className="flex flex-wrap items-center gap-2">
              <div role="radiogroup" aria-label="Part of the practice" className="inline-flex rounded-full bg-surface-300 p-[3px]">
                {PARTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={draft.part === p}
                    onClick={() => set('part', p)}
                    className={`min-h-9 rounded-full px-4 text-sm ${draft.part === p ? 'bg-surface-100 font-semibold shadow-sm' : 'text-ink-200 hover:text-ink-100'}`}
                  >
                    {PART_LABEL[p]}
                  </button>
                ))}
              </div>
              {draft.lessons.length > 0 && <span className="text-sm text-ink-200">Hockey Canada U7 Lesson {draft.lessons.join(', ')}</span>}
            </div>
          </Section>

          <Section title="Setup">
            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
              <Field label="Minutes" error={errors.minutes}>
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

          <Section title="Description">
            <Field label="How it runs" error={errors.description}>
              <textarea rows={4} className={input} value={draft.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
          </Section>

          <Section title="Steps" hint="One sentence each. Step numbers match the diagram.">
            <ListEditor items={draft.steps} max={6} numbered onChange={(v) => set('steps', v)} error={errors.steps} addLabel="Add a step" />
          </Section>

          <Section title="Cues" hint="What the coach says on the ice. Two is plenty.">
            <ListEditor items={draft.cues} max={3} onChange={(v) => set('cues', v)} error={errors.cues} addLabel="Add a cue" />
          </Section>

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
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-100 bg-surface-100 pb-[env(safe-area-inset-bottom,0px)]">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
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

function GroupPicker({ value, onChange }: { value: string[]; onChange: (v: (typeof GROUPS)[number][]) => void }) {
  return (
    <fieldset className="flex flex-wrap gap-1.5">
      <legend className="sr-only">Groups at this level</legend>
      {GROUPS.map((g) => {
        const on = value.includes(g);
        return (
          <button
            key={g}
            type="button"
            aria-pressed={on}
            onClick={() => onChange((on ? value.filter((x) => x !== g) : [...value, g]) as (typeof GROUPS)[number][])}
            className={`min-h-8 rounded-full border px-2.5 text-xs font-medium ${on ? 'border-ink-100 bg-ink-100 text-surface-100' : 'border-border-100 text-ink-200'}`}
          >
            {g}
          </button>
        );
      })}
    </fieldset>
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
