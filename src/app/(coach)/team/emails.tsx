'use client';

import { useState, useTransition } from 'react';
import { setCheckinEmails } from './actions';
import { setProgressEmails } from '../progress/actions';

export type TeamEmailSettings = { id: string; name: string; role: 'head_coach' | 'coach'; checkin: boolean; /** Null when the team's age group has no progress. */ progress: boolean | null };

/**
 * Your emails, one group per team you're on (decision 0031, in Account). Each coach decides for
 * themselves. Sign-in codes aren't here: they always come.
 */
export function EmailSettings({ teams, email }: { teams: TeamEmailSettings[]; email: string }) {
  const many = teams.length > 1;
  return (
    <section id="emails" aria-labelledby="h-emails" className="flex scroll-mt-24 flex-col gap-1 border-t border-border-100 pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="h-emails" className="text-[15px] font-semibold">
          {many ? 'Emails' : `Emails from ${teams[0]?.name ?? 'your team'}`}
        </h2>
        {many && <span className="text-[13px] text-ink-200">Each team has its own</span>}
      </div>
      <p className="text-sm text-ink-200">To {email}. Sign-in codes always come, whatever you choose here.</p>
      {teams.map((t) => (
        <div key={t.id} role="group" aria-label={many ? t.name : undefined} className="flex flex-col">
          {many && <h3 className="pt-4 text-sm font-semibold">{t.name}</h3>}
          <Switch teamId={t.id} kind="checkin" initial={t.checkin} title="After-practice check-in" desc="30 minutes after each practice: how did it go? About 20 seconds, and it shapes the next plan." />
          {t.progress !== null && <Switch teamId={t.id} kind="progress" initial={t.progress} title="Progress" desc="When a scoring round opens, one reminder if you haven’t scored, and the report once you have." />}
        </div>
      ))}
    </section>
  );
}

function Switch({ teamId, kind, initial, title, desc }: { teamId: string; kind: 'checkin' | 'progress'; initial: boolean; title: string; desc: string }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = `${kind}-${teamId}`;
  const toggle = () => {
    const next = !on;
    setOn(next);
    setError(null);
    start(async () => {
      const r = kind === 'checkin' ? await setCheckinEmails(teamId, next) : await setProgressEmails(teamId, next);
      if (!r.ok) {
        setOn(!next);
        setError(r.error ?? 'Couldn’t save that.');
      }
    });
  };
  return (
    <div className="flex flex-col border-t border-border-100 py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="flex flex-col gap-0.5">
          <span id={id} className="text-[15px] font-semibold">
            {title}
          </span>
          <span className="text-[13px] text-ink-200">{desc}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={id}
          disabled={pending}
          onClick={toggle}
          className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-rink-100' : 'bg-ink-200'}`}
        >
          <span className={`absolute left-1 top-1 size-6 rounded-full bg-surface-100 shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
        </button>
      </div>
      {error && (
        <p role="alert" className="pt-1 text-sm text-flag-100">
          {error}
        </p>
      )}
    </div>
  );
}
