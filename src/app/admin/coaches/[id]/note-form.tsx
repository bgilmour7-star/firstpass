'use client';

import { useState, useTransition } from 'react';
import { NOTE_KINDS, NOTE_KIND_LABEL, NO_KIDS, type NoteKind } from '@/lib/discovery/schema';
import { addNote } from '../../survey/actions';

// Add a note (canvas A2): where it came from, then their words. Themes are tagged by the daily task.
export function NoteForm({ personId }: { personId: string }) {
  const [kind, setKind] = useState<NoteKind>('call');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        start(async () => {
          const r = await addNote(personId, kind, body);
          if (r.ok) {
            setBody('');
            setError('');
            setSaved(true);
          } else setError(r.error);
        });
      }}
      className="flex flex-col gap-2.5 rounded-xl border border-border-100 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor="note" className="text-sm font-semibold">
          Add a note
        </label>
        <div role="group" aria-label="Where it came from" className="inline-flex flex-wrap gap-1 rounded-full bg-surface-300 p-1">
          {NOTE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`min-h-9 rounded-full px-3.5 text-[13px] ${kind === k ? 'bg-surface-100 font-semibold text-ink-100 shadow-[0_1px_2px_rgba(14,27,30,0.12)]' : 'font-medium text-ink-200 hover:text-ink-100'}`}
            >
              {NOTE_KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>
      <textarea
        id="note"
        rows={3}
        maxLength={5000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What did they say or do? Their words are best."
        aria-describedby="note-kids"
        className="w-full resize-y rounded-[10px] border-[1.5px] border-border-200 bg-surface-100 px-3.5 py-3 text-[15px] leading-[22px] text-ink-100 focus:border-rink-100 focus:outline-none focus:ring-[3px] focus:ring-rink-100/25"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span id="note-kids" className="text-[13px] text-ink-200">
          {NO_KIDS} Claude tags themes each morning.
        </span>
        <span className="flex items-center gap-3">
          {saved && (
            <span role="status" className="text-[13px] text-good-100">
              Saved
            </span>
          )}
          <button type="submit" disabled={pending || !body.trim()} className="min-h-10 rounded-full bg-rink-100 px-5 text-sm font-semibold text-surface-100 hover:bg-rink-200 disabled:opacity-[var(--opacity-disabled)]">
            {pending ? 'Saving…' : 'Save note'}
          </button>
        </span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-flag-100">
          {error}
        </p>
      )}
    </form>
  );
}
