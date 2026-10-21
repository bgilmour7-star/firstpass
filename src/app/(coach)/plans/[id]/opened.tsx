'use client';

import { useEffect, useRef, useState } from 'react';
import { Rink } from '@/components/ds';
import { firstpass } from '@/lib/ds/bundle.mjs';
import type { RinkDiagramApi, RinkDiagramProps } from '../../../../../design-system/index';
import { levelCount, levelOf, type Drill } from '@/lib/drills/schema';
import { blockLevels, levelMinutes, type DrillBlock } from '@/lib/plans/schema';

// Pieces of an opened drill in the plan (decision 0024, "treatment A"): the diagram with Play, the
// levels as one row of choices, and the icon buttons along the bottom.

const RD = firstpass.RinkDiagram as RinkDiagramApi;

/** The full diagram with a Play button: the same animation as rink-side, captions only while it plays. */
export function PlayableRink({ spec, title }: { spec: RinkDiagramProps; title: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const player = useRef<{ play(): void; stop(): void } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [caption, setCaption] = useState('');
  useEffect(() => () => player.current?.stop(), []);
  const play = () => {
    if (!stage.current) return;
    player.current?.stop();
    player.current = RD.animate(stage.current, { ...spec, title }, {
      onStep: (_n: number, c: string) => setCaption(c || ''),
      onDone: () => {
        setCaption('');
        setTimeout(() => setPlaying(false), 700);
      },
    });
    setPlaying(true);
    player.current.play();
  };
  const steps = (spec.paths ?? []).some((p) => p.step != null);
  return (
    <div className="flex max-w-[560px] flex-col gap-1.5">
      <div className="relative overflow-hidden rounded-[10px] border border-border-100">
        <div hidden={playing}>
          <Rink spec={spec} title={title} />
        </div>
        <div ref={stage} hidden={!playing} />
        {steps && !playing && (
          <button type="button" onClick={play} className="absolute bottom-2.5 left-2.5 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-ink-100 pl-2.5 pr-3.5 text-sm font-semibold text-surface-100 hover:opacity-90">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
            </svg>
            Play
          </button>
        )}
      </div>
      {playing && (
        <p aria-live="polite" className="min-h-[18px] text-[13px] text-ink-200">
          {caption}
        </p>
      )}
    </div>
  );
}

/** Levels as one row of choices: the group does the ones that are on, in order, sharing the minutes. */
export function LevelPills({ block, drill, suggested, onLevels }: { block: DrillBlock; drill: Drill; suggested?: number; onLevels: (levels: number[]) => void }) {
  const on = blockLevels(drill, block);
  const mins = levelMinutes(block.minutes, on.length);
  const all = Array.from({ length: levelCount(drill) }, (_, i) => levelOf(drill, i + 1));
  const toggle = (n: number) => {
    const next = on.includes(n) ? on.filter((x) => x !== n) : [...on, n].sort((x, y) => x - y);
    if (next.length) onLevels(next);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] text-ink-200">{on.length > 1 ? `Levels ${on.join(' → ')}: everyone does them in order, ${mins[0]} min each` : 'Levels: switch on more and everyone does them in order'}</span>
      <div role="group" aria-label={`Levels of ${drill.funName}`} className="flex flex-wrap gap-1.5">
        {all.map((l) => {
          const isOn = on.includes(l.n);
          const sug = suggested === l.n && !isOn;
          return (
            <button
              key={l.n}
              type="button"
              aria-pressed={isOn}
              aria-disabled={isOn && on.length === 1 ? true : undefined}
              title={l.n === 1 ? 'As written' : `Adds: ${l.adds}`}
              onClick={() => toggle(l.n)}
              className={`relative inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] ${isOn ? 'border-[1.5px] border-ink-100 bg-surface-300 font-semibold' : sug ? 'border-[1.5px] border-dashed border-whistle-100' : 'border border-border-100 bg-surface-100 hover:bg-surface-200'}`}
            >
              <span className="font-mono">{l.n}</span> · {l.name}
              {sug && <span className="ml-1 rounded-full bg-whistle-100 px-1.5 text-[10px] font-semibold leading-4 text-surface-100">Suggested</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const icon = {
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  bin: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />,
};

/** A square icon button for the opened drill's bottom row (Move up, Move down, Remove). */
export function IconButton({ kind, label, onClick, disabled }: { kind: keyof typeof icon; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid size-[42px] shrink-0 place-items-center rounded-xl border border-border-100 bg-surface-100 text-ink-200 hover:text-ink-100 disabled:opacity-35 disabled:hover:text-ink-200 ${kind === 'bin' ? 'hover:text-flag-100' : ''}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {icon[kind]}
      </svg>
    </button>
  );
}
