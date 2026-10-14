'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { Team } from '@/lib/plans/schema';
import { saveTeam } from './actions';

const input = 'w-full rounded-md border border-border-100 bg-surface-100 px-3 py-2 text-[15px] leading-6';

export function TeamForm({ team, welcome }: { team: Team; welcome: boolean }) {
  const [t, setT] = useState(team);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const skaters = t.groups.reduce((n, g) => n + g.skaters, 0);

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveTeam(t);
          setMsg(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: r.error });
        });
      }}
    >
      <Section title="Team">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-ink-200">Name</span>
          <input className={input} value={t.name} maxLength={80} onChange={(e) => setT({ ...t, name: e.target.value })} />
        </label>
      </Section>

      <Section title="Skill groups" hint={`${skaters} skaters. Counts only, never names.`}>
        <div className="grid grid-cols-3 gap-3">
          {t.groups.map((g, i) => (
            <label key={g.group} className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{g.group}</span>
              <input
                type="number"
                min={0}
                max={20}
                className={`${input} font-mono`}
                value={g.skaters}
                onChange={(e) => setT({ ...t, groups: t.groups.map((x, j) => (j === i ? { ...x, skaters: Number(e.target.value) || 0 } : x)) })}
              />
            </label>
          ))}
        </div>
        <p className="text-xs text-ink-200">Groups rotate through stations in this order: {t.groups.map((g) => g.group).join(' → ')}. New drills reach the Eagles first.</p>
      </Section>

      <Section title="Practices">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-200">Usual length (minutes)</span>
            <input type="number" min={20} max={120} step={5} className={`${input} font-mono`} value={t.practiceMinutes} onChange={(e) => setT({ ...t, practiceMinutes: Number(e.target.value) || 60 })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-200">Coaches on the ice</span>
            <input type="number" min={1} max={10} className={`${input} font-mono`} value={t.coachesOnIce} onChange={(e) => setT({ ...t, coachesOnIce: Number(e.target.value) || 1 })} />
          </label>
          <fieldset className="flex flex-col gap-1 sm:col-span-2">
            <legend className="mb-1 text-xs font-semibold text-ink-200">Ice</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['half', 'Half ice'],
                  ['full', 'Full ice'],
                  ['varies', 'It changes'],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={t.ice === v}
                  onClick={() => setT({ ...t, ice: v })}
                  className={`min-h-10 rounded-full border px-4 text-sm ${t.ice === v ? 'border-ink-100 bg-ink-100 text-surface-100' : 'border-border-100 hover:bg-surface-200'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-200">New drills a week (a default, not a rule)</span>
            <input type="number" min={0} max={10} className={`${input} font-mono`} value={t.newDrillsPerWeek} onChange={(e) => setT({ ...t, newDrillsPerWeek: Number(e.target.value) || 0 })} />
          </label>
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="min-h-11 rounded-full bg-rink-100 px-6 text-sm font-medium text-surface-100 hover:bg-rink-200 disabled:opacity-[var(--opacity-disabled)]">
          {pending ? 'Saving…' : 'Save'}
        </button>
        {welcome && (
          <Link href="/plans" className="min-h-11 rounded-full border border-border-100 px-5 py-2.5 text-sm font-medium hover:bg-surface-200">
            Plan the first practice →
          </Link>
        )}
        {msg && (
          <span role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-good-100' : 'text-flag-100'}`}>
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}

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
