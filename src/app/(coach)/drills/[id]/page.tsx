import { levelCount, levelOf, PART_LABEL } from '@/lib/drills/schema';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireTeam } from '@/lib/auth';
import { getAppStore } from '@/lib/app/store';
import { Pips, Rink, RinkStepper } from '@/components/ds';

export const dynamic = 'force-dynamic';

// Read-only drill page for coaches. v1: coaches never edit drills, only their minutes in a plan.
export default async function DrillPage({ params }: { params: Promise<{ id: string }> }) {
  await requireTeam('/drills');
  const { id } = await params;
  const d = (await (await getAppStore()).libraryDrills()).find((x) => x.id === id);
  if (!d) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/drills" className="w-fit text-sm text-ink-200 hover:text-ink-100">
        ← All drills
      </Link>
      <div>
        <h1 className="text-[28px] font-extrabold leading-8">{d.funName}</h1>
        <p className="text-ink-200">
          {PART_LABEL[d.part]} · {d.plainName} · <span className="font-mono text-sm">{d.minutes} min</span> · {d.gear}
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <RinkStepper spec={d.diagram} title={d.funName} />
          {levelCount(d) > 1 && (
            <Section title="Levels">
              <ol className="grid gap-4 sm:grid-cols-3">
                {Array.from({ length: levelCount(d) }, (_, i) => levelOf(d, i + 1)).map((l) => (
                  <li key={l.n} className="flex flex-col gap-1.5">
                    <Rink spec={l.diagram} title={`${d.funName} level ${l.n}`} detail="thumb" className="rounded-sm border border-border-100" />
                    <span className="font-mono text-sm font-medium text-rink-100">Level {l.n}</span>
                    <b className="text-sm">{l.name}</b>
                    <span className="text-xs text-ink-200">{l.n === 1 ? 'The drill as written.' : `Adds: ${l.adds}`}</span>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-ink-200">In a plan, pick which levels are in play: one for everyone, or several spread over the groups.</p>
            </Section>
          )}
          {d.groupModel === 'rotation' && d.zones && (
            <Section title="Rotation zones">
              <ul>
                {d.zones.map((z) => (
                  <li key={z.station} className="grid grid-cols-[28px_minmax(0,1fr)] items-baseline gap-2 border-t border-border-100 py-2 text-sm">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink-100 font-mono text-xs text-surface-100">{z.station}</span>
                    <span className="flex flex-col gap-0.5">
                      <b>{z.name}</b>
                      <span>{z.how}</span>
                      <span className="font-semibold">“{z.cue}”</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink-200">Every group does every zone, moving on the whistle.</p>
            </Section>
          )}
          {d.groupModel === 'stations' && d.stations && (
            <Section title="Group stations">
              <ul>
                {d.stations.map((s) => (
                  <li key={s.station} className="grid grid-cols-[28px_64px_minmax(0,1fr)] items-baseline gap-2 border-t border-border-100 py-2 text-sm">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink-100 font-mono text-xs text-surface-100">{s.station}</span>
                    <b>{s.group}</b>
                    <span>{s.version}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Section title="How it runs">
            <p className="text-[15px] leading-6">{d.description}</p>
            <ol className="flex flex-col gap-2">
              {d.steps.map((s, i) => (
                <li key={i} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2 text-sm">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink-100 font-mono text-[11px] text-surface-100">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </Section>
          <Section title="Say this">
            {d.cues.map((c) => (
              <p key={c} className="font-display text-lg font-bold">
                “{c}”
              </p>
            ))}
          </Section>
          <Section title="What it works on">
            <ul>
              {[...d.focus].sort((a, b) => b.level - a.level).map((f) => (
                <li key={f.attribute} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2 py-1 text-sm">
                  <span className="pt-0.5">
                    <Pips level={f.level} />
                  </span>
                  <span>
                    <b>{f.attribute}</b> · {f.why}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Source">
            <p className="text-sm">
              Adapted from{' '}
              {d.source.url ? (
                <a href={d.source.url} target="_blank" rel="noreferrer" className="text-rink-100 underline underline-offset-2">
                  {d.source.label}
                </a>
              ) : (
                d.source.label
              )}
              . Re-described and drawn by Firstpass.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t-2 border-ink-100 pt-3">
      <h2 className="text-[17px] font-extrabold">{title}</h2>
      {children}
    </section>
  );
}
