'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { FOCUS_ATTRIBUTES, PART_LABEL, PARTS } from '@/lib/drills/schema';
import { SHAPE_LABEL, SHAPES, type Answers } from '@/lib/requests/schema';
import { sendDrillRequest } from '@/app/(coach)/drills/request-actions';

// Asking for a drill (decision 0018). "Request a drill" opens a sheet with one row of choices and
// a description; "Suggest a change" opens one text box in place. Either way the confirmation sits
// where the request was made, in plain words: sent, Claude drafts it, then it's reviewed.

const box = 'w-full rounded-md border border-border-100 bg-surface-100 px-3 py-2 text-[15px] leading-6';
export const SENT_LINE = 'Sent. Claude drafts it by tomorrow morning, then it’s reviewed. You’ll get an email when it’s decided.';

function Choice<T extends string>({ label, options, value, onChange, labels }: { label: string; options: readonly T[]; value: T | undefined; onChange: (v: T | undefined) => void; labels: Record<T, string> }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(value === o ? undefined : o)}
            className={`min-h-9 rounded-full border px-3.5 text-sm ${value === o ? 'border-ink-100 bg-ink-100 text-surface-100' : 'border-border-100 hover:border-ink-200'}`}
          >
            {labels[o]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function RequestDrill({ prefill = '', variant = 'button' }: { prefill?: string; variant?: 'button' | 'link' }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <>
      {sent ? (
        <p role="status" className="text-sm text-good-100">
          {SENT_LINE}
        </p>
      ) : variant === 'button' ? (
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-full border border-ink-100 px-5 text-sm font-medium hover:bg-surface-200">
          Request a drill
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="font-semibold text-ink-100 underline underline-offset-2">
          Request it
        </button>
      )}
      {open && (
        <RequestSheet
          prefill={prefill}
          onClose={() => setOpen(false)}
          onSent={() => {
            setOpen(false);
            setSent(true);
          }}
        />
      )}
    </>
  );
}

function RequestSheet({ prefill, onClose, onSent }: { prefill: string; onClose: () => void; onSent: () => void }) {
  const [answers, setAnswers] = useState<Answers>({ focus: [], minutes: 8 });
  const [description, setDescription] = useState(prefill);
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const first = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  const toggleFocus = (a: (typeof FOCUS_ATTRIBUTES)[number]) =>
    setAnswers((x) => ({ ...x, focus: x.focus.includes(a) ? x.focus.filter((f) => f !== a) : x.focus.length >= 2 ? [x.focus[1], a] : [...x.focus, a] }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await sendDrillRequest({ kind: 'new', answers, description, link: link.trim() || null });
      if (r.ok) onSent();
      else setError(r.error);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-stretch" role="dialog" aria-modal="true" aria-label="Request a drill">
      <button type="button" aria-label="Close" tabIndex={-1} className="absolute inset-0 bg-ink-100/40" onClick={onClose} />
      <form onSubmit={submit} className="relative flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface-100 shadow-xl sm:h-full sm:max-w-[520px] sm:rounded-none">
        <span aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-100 sm:hidden" />
        <header className="flex items-start gap-3 border-b border-border-100 px-5 pb-4 pt-3 sm:pt-5">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[24px] font-extrabold leading-7">Request a drill</h2>
            <p className="mt-1 text-[13px] leading-5 text-ink-200">Claude drafts it with a diagram by tomorrow morning. It’s reviewed before any coach sees it.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="-mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-200 hover:bg-surface-200 hover:text-ink-100">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Describe it</span>
            <textarea
              ref={first}
              autoFocus
              required
              rows={5}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What do the kids do? What makes it fun? Where on the ice?"
              className={box}
            />
            <span className="text-xs text-ink-200">No kids’ names, please.</span>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">
              Link <span className="font-normal text-ink-200">· if you have one</span>
            </span>
            <input type="url" inputMode="url" maxLength={500} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" className={box} />
            <span className="text-xs text-ink-200">A web page or PDF works best. Claude can’t watch videos, so describe what happens in it.</span>
          </label>
          <Choice label="Part of practice" options={PARTS} labels={PART_LABEL} value={answers.part} onChange={(part) => setAnswers((x) => ({ ...x, part }))} />
          <Choice label="Shape" options={SHAPES} labels={SHAPE_LABEL} value={answers.shape} onChange={(shape) => setAnswers((x) => ({ ...x, shape }))} />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">
              Works on <span className="font-normal text-ink-200">· up to 2</span>
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {FOCUS_ATTRIBUTES.map((a) => {
                const on = answers.focus.includes(a);
                return (
                  <button key={a} type="button" aria-pressed={on} onClick={() => toggleFocus(a)} className={`min-h-9 rounded-full border px-3.5 text-sm ${on ? 'border-ink-100 bg-ink-100 text-surface-100' : 'border-border-100 hover:border-ink-200'}`}>
                    {a}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">About how long</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border-100 p-1">
              <button type="button" aria-label="Fewer minutes" onClick={() => setAnswers((x) => ({ ...x, minutes: Math.max(2, (x.minutes ?? 8) - 1) }))} className="h-9 w-9 rounded-full text-lg hover:bg-surface-200">
                −
              </button>
              <span className="w-14 text-center font-mono text-sm">{answers.minutes} min</span>
              <button type="button" aria-label="More minutes" onClick={() => setAnswers((x) => ({ ...x, minutes: Math.min(30, (x.minutes ?? 8) + 1) }))} className="h-9 w-9 rounded-full text-lg hover:bg-surface-200">
                +
              </button>
            </span>
          </div>
        </div>
        <footer className="flex flex-col gap-2 border-t border-border-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {error && (
            <p role="alert" className="text-sm text-flag-100">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="min-h-11 rounded-full px-5 text-sm font-medium text-ink-200 hover:bg-surface-200">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="min-h-11 rounded-full bg-rink-100 px-5 text-sm font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-60">
              {pending ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

/** "Suggest a change" on a drill: one text box, opened in place, with the confirmation beside it. */
export function SuggestChange({ drillId, drillName }: { drillId: string; drillName: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (sent)
    return (
      <p role="status" className="text-sm text-good-100">
        {SENT_LINE}
      </p>
    );
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-fit text-sm font-medium text-rink-100 hover:underline">
        Suggest a change
      </button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await sendDrillRequest({ kind: 'change', drillId, description: text });
          if (r.ok) setSent(true);
          else setError(r.error);
        });
      }}
      className="flex flex-col gap-2"
    >
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">What would make {drillName} work better?</span>
        <textarea autoFocus required rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Too much waiting in line? A level that's too hard? Say what you saw." className={box} />
        <span className="text-xs text-ink-200">No kids’ names, please. Claude drafts the change; the drill stays as it is until it’s reviewed.</span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-flag-100">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="min-h-10 rounded-full bg-rink-100 px-4 text-sm font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-60">
          {pending ? 'Sending…' : 'Send suggestion'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-full px-4 text-sm font-medium text-ink-200 hover:bg-surface-200">
          Cancel
        </button>
      </div>
    </form>
  );
}
