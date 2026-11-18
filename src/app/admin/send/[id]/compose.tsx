'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AGES, SEGMENTS, SEGMENT_LABEL, SEGMENT_NOTE, problems, type Block, type Draft } from '@/lib/broadcasts/schema';
import { deleteEmail, previewEmail, saveEmail, sendNow, sendTestEmail, uploadImage, whoGetsIt } from '../actions';

// The editor for one email (decision 0035): subject, blocks, who gets it, with the email in the Firstpass template
// beside it. Saves itself a moment after each change. Sending asks once more with the number of coaches, and stops
// if that number changed in between.

const input = 'w-full rounded-lg border border-border-200 bg-surface-100 px-3 py-2.5 text-[15px] leading-[22px] focus-visible:outline-2 focus-visible:outline-rink-100';
const label = 'text-sm font-semibold';
const quiet = 'inline-flex min-h-11 items-center rounded-full border-[1.5px] border-border-200 bg-surface-100 px-4 text-sm font-medium hover:bg-surface-300 disabled:opacity-[var(--opacity-disabled)]';
const NO_KIDS = 'No kids’ names, please.';
const NEW: Record<Block['type'], Block> = {
  text: { type: 'text', text: '' },
  heading: { type: 'heading', text: '' },
  image: { type: 'image', url: '', alt: '', link: '' },
  button: { type: 'button', label: '', url: '' },
};
const TYPE_LABEL: Record<Block['type'], string> = { text: 'Text', heading: 'Heading', image: 'Image', button: 'Button' };

export function Compose({ id, initial, to }: { id: string; initial: Draft; to: string }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(initial);
  const [saved, setSaved] = useState<'saved' | 'saving' | 'error' | 'idle'>('idle');
  const [saveError, setSaveError] = useState('');
  const [html, setHtml] = useState('');
  const [who, setWho] = useState<{ count: number; sample: string[] } | null>(null);
  const [whoError, setWhoError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  // What the server has, so a save only happens when something changed.
  const lastSaved = useRef(JSON.stringify(initial));

  const set = (patch: Partial<Draft>) => {
    setD((x) => ({ ...x, ...patch }));
    setConfirming(false);
  };
  const setBlock = (i: number, patch: Partial<Block>) => set({ blocks: d.blocks.map((b, j) => (j === i ? ({ ...b, ...patch } as Block) : b)) });
  const move = (i: number, by: number) => {
    const next = d.blocks.slice();
    const [b] = next.splice(i, 1);
    next.splice(i + by, 0, b);
    set({ blocks: next });
  };

  // Save a moment after each change, and redraw the preview.
  useEffect(() => {
    const t = setTimeout(async () => {
      const p = await previewEmail(d);
      if (p.ok) setHtml(p.html);
      const now = JSON.stringify(d);
      if (now === lastSaved.current) return;
      setSaved('saving');
      const r = await saveEmail(id, d);
      if (r.ok) lastSaved.current = now;
      setSaved(r.ok ? 'saved' : 'error');
      setSaveError(r.ok ? '' : r.error);
    }, 700);
    return () => clearTimeout(t);
  }, [d, id]);

  // Who gets it, whenever the segment changes.
  useEffect(() => {
    if (d.segment === 'age' && !d.ageGroup) {
      setWho(null);
      return;
    }
    let live = true;
    whoGetsIt(d.segment, d.ageGroup).then((r) => {
      if (!live) return;
      setWho(r.ok ? { count: r.count, sample: r.sample } : null);
      setWhoError(r.ok ? '' : r.error);
    });
    return () => {
      live = false;
    };
  }, [d.segment, d.ageGroup]);

  const todo = problems(d);
  const count = who?.count ?? 0;
  const coaches = (n: number) => `${n} ${n === 1 ? 'coach' : 'coaches'}`;

  function send() {
    setMsg(null);
    start(async () => {
      const r = await sendNow(id, d, count);
      if (!r.ok) {
        setConfirming(false);
        setMsg({ ok: false, text: r.error });
        if (r.error.startsWith('The list changed')) whoGetsIt(d.segment, d.ageGroup).then((w) => w.ok && setWho({ count: w.count, sample: w.sample }));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="subject" className={label}>
            Subject
          </label>
          <input id="subject" className={input} value={d.subject} maxLength={150} onChange={(e) => set({ subject: e.target.value })} placeholder="Firstpass is open: invite your coaches" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="preheader" className={label}>
            Preview line <span className="font-normal text-ink-200">(optional)</span>
          </label>
          <input id="preheader" className={input} value={d.preheader} maxLength={200} onChange={(e) => set({ preheader: e.target.value })} placeholder="Shown after the subject in most inboxes" />
        </div>
        <label className="flex min-h-11 items-center gap-2.5 text-[15px]">
          <input type="checkbox" checked={d.greeting} onChange={(e) => set({ greeting: e.target.checked })} className="size-5 accent-rink-100" />
          Start with “Hi Kara,” using each coach’s first name
        </label>

        <section aria-labelledby="body-title" className="flex flex-col gap-3">
          <h2 id="body-title" className={label}>
            Email
          </h2>
          <ol className="flex flex-col gap-3">
            {d.blocks.map((b, i) => (
              <li key={i} className="flex flex-col gap-2.5 rounded-xl border border-border-200 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink-200">{TYPE_LABEL[b.type]}</span>
                  <span className="flex gap-1">
                    <button type="button" aria-label={`Move ${TYPE_LABEL[b.type].toLowerCase()} up`} disabled={i === 0} onClick={() => move(i, -1)} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-200 disabled:opacity-[var(--opacity-disabled)]">
                      ↑
                    </button>
                    <button type="button" aria-label={`Move ${TYPE_LABEL[b.type].toLowerCase()} down`} disabled={i === d.blocks.length - 1} onClick={() => move(i, 1)} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-200 disabled:opacity-[var(--opacity-disabled)]">
                      ↓
                    </button>
                    <button type="button" aria-label={`Remove ${TYPE_LABEL[b.type].toLowerCase()}`} onClick={() => set({ blocks: d.blocks.filter((_, j) => j !== i) })} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm text-ink-200 hover:bg-surface-200 hover:text-ink-100">
                      Remove
                    </button>
                  </span>
                </div>
                <BlockFields b={b} i={i} onChange={(patch) => setBlock(i, patch)} />
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-200">Add</span>
            {(Object.keys(NEW) as Block['type'][]).map((t) => (
              <button key={t} type="button" className={quiet} onClick={() => set({ blocks: [...d.blocks, NEW[t]] })} disabled={d.blocks.length >= 40}>
                + {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </section>

        <fieldset className="flex flex-col gap-2">
          <legend className={`${label} mb-1`}>Who gets it</legend>
          {SEGMENTS.map((s) => (
            <label key={s} className="flex min-h-11 items-start gap-2.5 py-1">
              <input type="radio" name="segment" checked={d.segment === s} onChange={() => set({ segment: s, ageGroup: s === 'age' ? (d.ageGroup ?? 'U7') : null })} className="mt-1 size-5 accent-rink-100" />
              <span className="flex flex-col">
                <span className="text-[15px]">{SEGMENT_LABEL[s]}</span>
                <span className="text-[13px] text-ink-200">{SEGMENT_NOTE[s]}</span>
              </span>
            </label>
          ))}
          {d.segment === 'age' && (
            <div role="radiogroup" aria-label="Age group" className="ml-7 flex gap-2">
              {AGES.map((a) => (
                <button key={a} type="button" role="radio" aria-checked={d.ageGroup === a} onClick={() => set({ ageGroup: a })} className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium ${d.ageGroup === a ? 'bg-ink-100 text-surface-100' : 'border-[1.5px] border-border-200 hover:bg-surface-200'}`}>
                  {a}
                </button>
              ))}
            </div>
          )}
          <div className="mt-1 text-sm" aria-live="polite">
            {whoError ? (
              <span className="text-flag-100">{whoError}</span>
            ) : who ? (
              <details>
                <summary className="min-h-11 cursor-pointer py-2.5">
                  <b className="font-semibold">{coaches(who.count)}</b> <span className="text-rink-100">Show who</span>
                </summary>
                <ul className="mt-1 flex max-h-64 flex-col gap-1 overflow-y-auto text-[13px] text-ink-200">
                  {who.sample.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                  {who.count > who.sample.length && <li>and {who.count - who.sample.length} more</li>}
                </ul>
              </details>
            ) : (
              <span className="text-ink-200">Counting…</span>
            )}
          </div>
        </fieldset>

        <div className="flex flex-col gap-3 border-t border-border-100 pt-5">
          {todo.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-ink-200">
              {todo.map((t) => (
                <li key={t}>· {t}</li>
              ))}
            </ul>
          )}
          {confirming ? (
            <div role="alertdialog" aria-labelledby="confirm-text" className="flex flex-col gap-3 rounded-xl bg-surface-200 p-4">
              <p id="confirm-text" className="text-[15px]">
                Send “{d.subject.trim()}” to <b className="font-semibold">{coaches(count)}</b> now? You can’t undo it.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={pending} onClick={send} className="inline-flex min-h-11 items-center rounded-full bg-rink-100 px-5 text-sm font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-[var(--opacity-disabled)]">
                  {pending ? 'Sending…' : 'Send now'}
                </button>
                <button type="button" disabled={pending} onClick={() => setConfirming(false)} className={quiet}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={todo.length > 0 || !count || pending} onClick={() => setConfirming(true)} className="inline-flex min-h-11 items-center rounded-full bg-rink-100 px-5 text-sm font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-[var(--opacity-disabled)]">
                Send to {coaches(count)}
              </button>
              <button
                type="button"
                disabled={pending}
                className={quiet}
                onClick={() =>
                  start(async () => {
                    const r = await sendTestEmail(d);
                    setMsg(r.ok ? { ok: true, text: `Test sent to ${to}.` } : { ok: false, text: r.error });
                  })
                }
              >
                Send me a test
              </button>
              <button type="button" disabled={pending} onClick={() => start(async () => void (await deleteEmail(id)))} className="ml-auto inline-flex min-h-11 items-center rounded-full px-3 text-sm text-ink-200 hover:text-flag-100">
                Delete draft
              </button>
            </div>
          )}
          <p className="text-[13px] text-ink-200" aria-live="polite">
            {saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'Draft saved.' : saved === 'error' ? <span className="text-flag-100">{saveError}</span> : 'Changes save as you go.'}
          </p>
          {msg && (
            <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-good-100' : 'text-flag-100'}`}>
              {msg.text}
            </p>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2 xl:sticky xl:top-6 xl:self-start">
        <span className="text-sm font-semibold">What coaches see</span>
        <iframe title="Email preview" srcDoc={html} sandbox="" className="h-[720px] w-full rounded-xl border border-border-100 bg-surface-200" />
      </div>
    </div>
  );
}

function BlockFields({ b, i, onChange }: { b: Block; i: number; onChange: (patch: Partial<Block>) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fid = (n: string) => `b${i}-${n}`;
  switch (b.type) {
    case 'text':
      return (
        <>
          <label htmlFor={fid('text')} className="sr-only">
            Text
          </label>
          <textarea id={fid('text')} rows={5} className={input} value={b.text} maxLength={5000} onChange={(e) => onChange({ text: e.target.value })} />
          <p className="text-[13px] text-ink-200">A blank line starts a new paragraph. **bold** and [link text](https://…) work. {NO_KIDS}</p>
        </>
      );
    case 'heading':
      return (
        <>
          <label htmlFor={fid('heading')} className="sr-only">
            Heading
          </label>
          <input id={fid('heading')} className={input} value={b.text} maxLength={120} onChange={(e) => onChange({ text: e.target.value })} />
        </>
      );
    case 'button':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={fid('label')} className="text-[13px] text-ink-200">
              Button label
            </label>
            <input id={fid('label')} className={input} value={b.label} maxLength={40} onChange={(e) => onChange({ label: e.target.value })} placeholder="Plan your next practice" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={fid('url')} className="text-[13px] text-ink-200">
              Link
            </label>
            <input id={fid('url')} type="url" className={input} value={b.url} maxLength={500} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://firstpass.coach/plans" />
          </div>
        </div>
      );
    case 'image':
      return (
        <div className="flex flex-col gap-2.5">
          {b.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- an uploaded email image, shown as the coach will see it
            <img src={b.url} alt="" className="max-h-56 w-full rounded-lg bg-surface-200 object-contain" />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <label className={`${quiet} cursor-pointer`}>
              {busy ? 'Uploading…' : b.url ? 'Replace image' : 'Upload image'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="sr-only"
                disabled={busy}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  setBusy(true);
                  setErr('');
                  const form = new FormData();
                  form.set('file', f);
                  const r = await uploadImage(form);
                  setBusy(false);
                  // Never filled from the file name: a name like jake-first-goal.jpg would put a child's name in every inbox.
                  if (r.ok) onChange({ url: r.url });
                  else setErr(r.error);
                }}
              />
            </label>
            <span className="text-[13px] text-ink-200">PNG, JPG, GIF or WebP, up to 2 MB. Never a photo of a child.</span>
          </div>
          {err && (
            <p role="alert" className="text-[13px] text-flag-100">
              {err}
            </p>
          )}
          <details className="text-[13px]">
            <summary className="min-h-11 cursor-pointer py-2.5 text-rink-100">Or use an image link</summary>
            <input aria-label="Image link" type="url" className={input} value={b.url} maxLength={500} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://…" />
          </details>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={fid('alt')} className="text-[13px] text-ink-200">
                Describe it (shown when images are off)
              </label>
              <input id={fid('alt')} className={input} value={b.alt} maxLength={200} onChange={(e) => onChange({ alt: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={fid('link')} className="text-[13px] text-ink-200">
                Link when tapped (optional)
              </label>
              <input id={fid('link')} type="url" className={input} value={b.link} maxLength={500} onChange={(e) => onChange({ link: e.target.value })} placeholder="https://…" />
            </div>
          </div>
        </div>
      );
  }
}
