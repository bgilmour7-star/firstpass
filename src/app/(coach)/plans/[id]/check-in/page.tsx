import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { rateUnits, summarize } from '@/lib/plans/checkin';
import { addMinutes, clock, todayUnits, withStationDrills } from '@/lib/plans/schema';
import { initials } from '@/lib/plans/activity';
import { CheckinForm } from './form';

export const dynamic = 'force-dynamic';

const weekday = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long' });
const short = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });

export default async function CheckinPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; edit?: string }> }) {
  const { coach, team } = await requireTeam('/plans');
  const { id } = await params;
  const { saved, edit } = await searchParams;
  const store = await getAppStore();
  const found = await store.getPractice(id);
  if (!found || found.teamId !== team.id) notFound();
  const [drills, all, plans, coaches] = await Promise.all([store.libraryDrills(), store.teamCheckins(team.id), store.listPractices(team.id), store.coachCount(team.id)]);
  const byId = new Map(drills.map((d) => [d.id, d]));
  const p = { ...found, blocks: withStationDrills(found.blocks, byId) };
  const units = rateUnits(p, team, byId);
  const here = all.filter((c) => c.practiceId === p.id);
  const mine = here.find((c) => c.userId === coach.id) ?? null;
  const others = here.filter((c) => c.userId !== coach.id);
  const skaters = todayUnits(team, p.attendance).reduce((n, u) => n + u.skaters, 0);
  const day = weekday(p.date);
  const header = (
    <div className="flex flex-col gap-0.5">
      <span className="text-[13px] text-ink-200">
        {short(p.date)} · {clock(p.startTime)}–{clock(addMinutes(p.startTime, p.minutes))}
      </span>
    </div>
  );

  // After saving: what everyone's answers add up to, and who still has to check in.
  if (saved && mine && !edit) {
    const dates = new Map(plans.map((x) => [x.id, x.date]));
    const earlier = all.filter((c) => (dates.get(c.practiceId) ?? '') < p.date);
    const s = summarize(here, units, earlier);
    const next = [...plans].reverse().find((x) => x.date > p.date);
    const othersNamed = s.coaches.filter((c) => c.userId !== coach.id).map((c) => c.editor);
    const left = Math.max(0, coaches - here.length);
    const flopFor = (key: string) => s.lostSteam && s.lostSteam.unit.key === key;
    return (
      <div className="mx-auto flex max-w-md flex-col">
        <div className="flex flex-col gap-1 pb-4">
          <span className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-good-100 text-surface-100" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          {header}
          <h1 className="font-display text-[26px] font-extrabold leading-8">{day}&rsquo;s in</h1>
          <p className="text-ink-200">{othersNamed.length ? `With ${othersNamed.join(' and ')}’s answers, here’s what it adds up to.` : 'Here’s what it adds up to.'}</p>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border-100 py-4 text-[13px]">
          <Tally n={s.hits.length} label={s.hits.length === 1 ? 'Big hit' : 'Big hits'} tone="text-good-100" />
          <Tally n={s.flops.length} label="Flopped" tone="text-whistle-100" />
          {s.split.length > 0 && <Tally n={s.split.length} label="Split" />}
          {s.lostSteam && <Tally n={s.lostSteam.unit.time} label={s.lostSteam.how === 'bored' ? 'Got bored' : 'Got tired'} />}
        </div>

        {(s.flops.length > 0 || s.ready.length > 0 || s.again.length > 0 || s.split.length > 0 || s.lostSteam) && (
          <section className="border-t border-border-100 py-4">
            <h2 className="mb-1 font-display text-base font-bold">For your next plans</h2>
            <ul className="flex flex-col">
              {s.flops.map((u) => (
                <Change key={u.key} icon="flop" title={`${u.name} flopped`}>
                  {[u.reasons.join(', '), flopFor(u.key) ? `they ${s.lostSteam!.how === 'bored' ? 'got bored' : 'got tired'} from here` : ''].filter(Boolean).join(', and ') || `Marked by ${u.by.join(' and ')}.`}
                </Change>
              ))}
              {s.lostSteam && !s.flops.some((u) => flopFor(u.key)) && (
                <Change icon="flop" title={`${s.lostSteam.how === 'bored' ? 'Got bored' : 'Got tired'} from ${s.lostSteam.unit.name}`}>
                  At {s.lostSteam.unit.time}. Mix in a fun game or a different skill around there next time.
                </Change>
              )}
              {s.ready.length > 0 && (
                <Change icon="up" title={`${s.ready.join(' and ')} ready for harder`}>
                  Switch on the next level of a drill they know.
                </Change>
              )}
              {s.again.map((u) => (
                <Change key={u.key} icon="hit" title={`${u.name}: Big hit again`}>
                  A keeper. They’ve loved it more than once.
                </Change>
              ))}
              {s.split.map((u) => (
                <Change key={u.key} icon="split" title={`Coaches split on ${u.name}`}>
                  One said Big hit, one said Flopped. Worth a word before the next plan.
                </Change>
              ))}
            </ul>
          </section>
        )}

        <section className="border-t border-border-100 py-4">
          <h2 className="mb-2 font-display text-base font-bold">Coaches</h2>
          <ul className="flex flex-col gap-2">
            {here
              .slice()
              .sort((a, b) => Number(b.userId === coach.id) - Number(a.userId === coach.id))
              .map((c) => (
                <li key={c.userId} className="flex items-center gap-2.5 text-[15px]">
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${c.userId === coach.id ? 'bg-ink-100 text-surface-100' : 'bg-surface-300'}`}>{initials(c.editor)}</span>
                  {c.userId === coach.id ? 'You' : c.editor}
                  <span className="ml-auto text-[13px] font-semibold text-good-100">Checked in</span>
                </li>
              ))}
            {left > 0 && <li className="text-[13px] text-ink-200">{left === 1 ? '1 coach hasn’t checked in yet.' : `${left} coaches haven’t checked in yet.`}</li>}
          </ul>
        </section>

        <div className="flex flex-col gap-2 border-t border-border-100 pt-4">
          <Link href={next ? `/plans/${next.id}` : '/plans'} className="grid min-h-12 place-items-center rounded-full bg-rink-100 px-5 text-base font-semibold text-surface-100 hover:bg-rink-200">
            {next ? `Open ${weekday(next.date)}’s plan` : 'Back to plans'}
          </Link>
          <Link href={`/plans/${p.id}/check-in?edit=1`} className="mx-auto min-h-9 px-3 py-2 text-sm font-medium text-rink-100">
            Change my answers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <CheckinForm
      practiceId={p.id}
      day={day}
      header={header}
      stats={{ minutes: p.minutes, drills: units.length, skaters }}
      units={units}
      initial={mine}
      others={others.map((c) => ({ initial: initials(c.editor), name: c.editor, overall: c.overall, steam: c.steam, ready: c.ready, marks: c.marks }))}
    />
  );
}

function Tally({ n, label, tone = '' }: { n: number | string; label: string; tone?: string }) {
  return (
    <span>
      <b className={`block font-mono text-lg font-semibold ${tone}`}>{n}</b>
      {label}
    </span>
  );
}

function Change({ icon, title, children }: { icon: 'flop' | 'up' | 'hit' | 'split'; title: string; children: React.ReactNode }) {
  const glyph = {
    flop: <path d="M10 2.5 L18 16.5 H2 Z" fill="none" stroke="var(--whistle-100)" strokeWidth="1.8" strokeLinejoin="round" />,
    up: <path d="M4 11h8M9 6l5 5-5 5" fill="none" stroke="var(--rink-100)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
    hit: (
      <>
        <circle cx="10" cy="10" r="7" fill="none" stroke="var(--good-100)" strokeWidth="2" />
        <path d="M6.8 10.3l2.2 2.2 4.3-4.6" fill="none" stroke="var(--good-100)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    split: <path d="M4 10h12M10 4v12" fill="none" stroke="var(--ink-200)" strokeWidth="2" strokeLinecap="round" />,
  }[icon];
  return (
    <li className="grid grid-cols-[22px_minmax(0,1fr)] gap-2 border-t border-border-100 py-2.5 first:border-t-0">
      <svg viewBox="0 0 20 20" width="18" height="18" className="mt-0.5" aria-hidden="true">
        {glyph}
      </svg>
      <span>
        <b className="font-semibold">{title}</b>
        <span className="block text-[13px] text-ink-200">{children}</span>
      </span>
    </li>
  );
}
