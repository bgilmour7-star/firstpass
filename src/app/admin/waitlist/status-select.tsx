'use client';

import { useState, useTransition } from 'react';
import { WAITLIST_STATUSES, WAITLIST_STATUS_LABEL, type WaitlistStatus } from '@/lib/site/schema';
import { setWaitlistStatus } from './actions';

// A dot beside the word, never colour alone: orange = new (needs your email), teal = call booked,
// green = onboarded, grey = everything else.
const DOT: Record<WaitlistStatus, string> = { new: 'bg-whistle-100', emailed: 'bg-ink-200', call_booked: 'bg-rink-100', onboarded: 'bg-good-100', not_a_fit: 'bg-border-200' };

export function StatusSelect({ id, email, status }: { id: string; email: string; status: WaitlistStatus }) {
  const [value, setValue] = useState(status);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`size-2 flex-none rounded-full ${DOT[value]}`} />
      <select
        aria-label={`Status for ${email}`}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as WaitlistStatus;
          const before = value;
          setValue(next);
          setError('');
          start(async () => {
            const r = await setWaitlistStatus(id, next);
            if (!r.ok) {
              setValue(before);
              setError(r.error);
            }
          });
        }}
        className="min-h-9 rounded-lg border border-border-200 bg-surface-100 px-2 text-sm text-ink-100"
      >
        {WAITLIST_STATUSES.map((s) => (
          <option key={s} value={s}>
            {WAITLIST_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="text-xs text-flag-100">
          {error}
        </span>
      )}
    </span>
  );
}
