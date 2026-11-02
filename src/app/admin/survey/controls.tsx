'use client';

import { useState, useTransition } from 'react';
import type { CallStatus, GiftCard } from '@/lib/discovery/schema';
import { setCallStatus, setGiftCard, setThemes } from './actions';

const pill = 'inline-flex min-h-10 items-center rounded-full border border-border-200 bg-surface-100 px-3.5 text-[13px] font-medium text-ink-100 hover:bg-surface-200 disabled:opacity-[var(--opacity-disabled)]';

/** Mark booked and Card sent (canvas A1), each undoable. */
export function ResponseActions({ id, wantsCall, callStatus, giftCard, cardDate }: { id: string; wantsCall: boolean; callStatus: CallStatus; giftCard: GiftCard; cardDate?: string }) {
  const [call, setCall] = useState(callStatus);
  const [card, setCard] = useState(giftCard);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, undo: () => void) =>
    start(async () => {
      setError('');
      const r = await fn();
      if (!r.ok) {
        undo();
        setError(r.error ?? 'Couldn’t save.');
      }
    });
  return (
    <span className="flex flex-wrap items-center gap-2">
      {wantsCall &&
        (call === 'to_book' ? (
          <button type="button" disabled={pending} className={pill} onClick={() => (setCall('booked'), run(() => setCallStatus(id, 'booked'), () => setCall('to_book')))}>
            Mark booked
          </button>
        ) : (
          <button type="button" disabled={pending} className="inline-flex min-h-10 items-center gap-1.5 text-[13px] text-ink-200 hover:text-ink-100" onClick={() => (setCall('to_book'), run(() => setCallStatus(id, 'to_book'), () => setCall(call)))} title="Undo">
            <Check /> Call {call === 'done' ? 'done' : 'booked'}
          </button>
        ))}
      {card === 'owed' ? (
        <button type="button" disabled={pending} className={pill} onClick={() => (setCard('sent'), run(() => setGiftCard(id, 'sent'), () => setCard('owed')))}>
          Card sent
        </button>
      ) : card === 'sent' ? (
        <button type="button" disabled={pending} className="inline-flex min-h-10 items-center gap-1.5 text-[13px] text-ink-200 hover:text-ink-100" onClick={() => (setCard('owed'), run(() => setGiftCard(id, 'owed'), () => setCard('sent')))} title="Undo">
          <Check /> Card sent{cardDate ? ` ${cardDate}` : ''}
        </button>
      ) : null}
      {error && (
        <span role="alert" className="text-xs text-flag-100">
          {error}
        </span>
      )}
    </span>
  );
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2.5 7.5 5.5 10.5 11.5 3.5" fill="none" stroke="var(--good-100)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** "Themes: A · B", with Edit to change them by hand (the daily task tags them first). */
export function Themes({ kind, id, themes, known }: { kind: 'response' | 'note'; id: string; themes: string[]; known: string[] }) {
  const [list, setList] = useState(themes);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(themes.join(', '));
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const listId = `themes-${id}`;
  if (!editing)
    return (
      <span className="text-[13px] text-ink-200">
        {list.length ? `Themes: ${list.join(' · ')}` : 'No themes yet'}{' '}
        <button type="button" onClick={() => setEditing(true)} className="ml-1 inline-flex min-h-8 items-center text-rink-100 hover:underline">
          Edit<span className="sr-only"> themes</span>
        </button>
      </span>
    );
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setThemes(kind, id, value);
          if (r.ok) {
            setList([...new Set(value.split(',').map((t) => t.trim()).filter(Boolean))]);
            setEditing(false);
            setError('');
          } else setError(r.error);
        });
      }}
    >
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Themes, separated by commas
      </label>
      <input id={`${listId}-input`} list={listId} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Kids standing around, Who pays" className="min-h-10 min-w-0 flex-1 rounded-lg border border-border-200 bg-surface-100 px-3 text-sm" autoFocus />
      <datalist id={listId}>
        {known.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      <button type="submit" disabled={pending} className="min-h-10 rounded-full bg-rink-100 px-4 text-[13px] font-semibold text-surface-100 hover:bg-rink-200">
        Save
      </button>
      <button type="button" onClick={() => setEditing(false)} className="min-h-10 px-2 text-[13px] text-ink-200 hover:text-ink-100">
        Cancel
      </button>
      {error && (
        <span role="alert" className="w-full text-xs text-flag-100">
          {error}
        </span>
      )}
    </form>
  );
}
